// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIdentityGate} from "./interfaces/IIdentityGate.sol";
import {ReputationRegistry} from "./ReputationRegistry.sol";
import {Tiers} from "./Tiers.sol";

/// @title ROSCAPool
/// @notice One ROSCA cycle: N members each lock collateral (50% of the pot), a verifiable
///         random order decides who receives the full pot each round, everyone contributes
///         every round, misses are slashed from collateral, and reputation is written at
///         the end. Spec §5.
/// @dev Randomness is behind a virtual seam (`_requestRandomness`) so the dev build shuffles
///      with a pseudo-random seed and the VRF build (later) overrides it to call Chainlink.
///      When the coordinator answers, it calls `_onRandomness`.
///
///      Design decisions locked (spec §10):
///      - Q3: the creator joins via the same `join()` path as everyone else.
///      - Q4: real per-round `contribute()`; unpaid at window close = slash.
///      - Q5: ENS subname mint (added later) will be non-reverting so it can't block join.
contract ROSCAPool {
    using SafeERC20 for IERC20;
    using Tiers for Tiers.Tier;

    enum Status {
        OPEN, // accepting joins
        LOCKED, // full; awaiting randomness
        ROUND_ACTIVE, // cycle running
        COMPLETE, // all rounds done, settled
        CANCELLED // never filled / cancelled while OPEN

    }

    struct Member {
        address wallet;
        bytes32 idKey;
        uint256 collateral; // remaining collateral
        bool hasReceivedPot;
        bool active; // false once ejected
        bool defaultedThisCycle;
    }

    // --- immutable config ---
    uint256 public immutable poolId;
    address public immutable creator;
    IERC20 public immutable token;
    IIdentityGate public immutable identityGate;
    ReputationRegistry public immutable reputation;

    uint256 public immutable contribution; // per member, per round
    uint8 public immutable memberCount; // N
    uint32 public immutable periodSeconds;
    uint32 public immutable windowSeconds;
    uint8 public immutable minScore;
    bool public immutable acceptDefaulted;
    bool public immutable inviteOnly;

    uint256 public immutable pot; // contribution * memberCount
    uint256 public immutable collateralReq; // pot / 2 (50%)

    // --- protocol fee (basis points of one round's pot) ---
    uint16 public constant PROTOCOL_FEE_BPS = 200; // 2%
    uint16 public constant CREATOR_FEE_BPS = 500; // 5% (invite-only, full completion only)
    address public immutable treasury;

    // --- mutable state ---
    Status public status;
    Member[] public members;
    mapping(address => uint256) public slotOfPlusOne; // wallet => index+1 (0 = not a member)

    uint8 public currentRound; // 1..N once active
    uint256 public roundEndsAt;
    uint256 public windowEndsAt;
    uint8[] public payoutOrder; // payoutOrder[r-1] = member slot paid in round r
    mapping(uint8 => mapping(uint256 => bool)) public paid; // round => slot => paid

    // --- events (The Graph indexes these; spec §6) ---
    event MemberJoined(uint256 indexed poolId, address indexed wallet, bytes32 idKey, uint256 slot, bool liveGate);
    event PoolCancelled(uint256 indexed poolId);
    event CycleStarted(uint256 indexed poolId, uint8[] payoutOrder);
    event ContributionPaid(uint256 indexed poolId, uint8 indexed round, uint256 slot);
    event MemberSlashed(uint256 indexed poolId, uint8 indexed round, uint256 slot, uint256 amount, uint256 remaining);
    event MemberEjected(uint256 indexed poolId, uint256 slot);
    event PotPaid(uint256 indexed poolId, uint8 indexed round, uint256 winnerSlot, uint256 amount);
    event RoundAdvanced(uint256 indexed poolId, uint8 newRound);
    event CycleCompleted(uint256 indexed poolId);

    error WrongStatus();
    error AlreadyJoined();
    error ExceedsTier();
    error BelowMinScore();
    error HasDefaulted();
    error NotAMember();
    error AlreadyPaidThisRound();
    error WindowClosed();
    error NotYetTimeToAdvance();

    struct InitParams {
        uint256 poolId;
        address creator;
        address token;
        address identityGate;
        address reputation;
        address treasury;
        uint256 contribution;
        uint8 memberCount;
        uint32 periodSeconds;
        uint32 windowSeconds;
        uint8 minScore;
        bool acceptDefaulted;
        bool inviteOnly;
    }

    constructor(InitParams memory p) {
        poolId = p.poolId;
        creator = p.creator;
        token = IERC20(p.token);
        identityGate = IIdentityGate(p.identityGate);
        reputation = ReputationRegistry(p.reputation);
        treasury = p.treasury;
        contribution = p.contribution;
        memberCount = p.memberCount;
        periodSeconds = p.periodSeconds;
        windowSeconds = p.windowSeconds;
        minScore = p.minScore;
        acceptDefaulted = p.acceptDefaulted;
        inviteOnly = p.inviteOnly;

        pot = p.contribution * p.memberCount;
        collateralReq = pot / 2; // 50% of the pot
        status = Status.OPEN;
    }

    // ---------------------------------------------------------------------
    // Join (spec §5.3)
    // ---------------------------------------------------------------------

    /// @notice Join the pool: pass the identity gate, meet tier/score rules, lock collateral.
    ///         Fills a slot; the Nth join locks the pool and requests the payout order.
    function join(bytes calldata proof) external {
        if (status != Status.OPEN) revert WrongStatus();
        if (slotOfPlusOne[msg.sender] != 0) revert AlreadyJoined();

        bytes32 idKey = identityGate.verifyJoin(msg.sender, poolId, proof); // hard gate at join

        // per-joiner tier ceiling (anti-sybil)
        Tiers.Tier t = reputation.tierOf(idKey);
        if (contribution > t.maxContribution() || memberCount > t.maxMembers()) revert ExceedsTier();
        if (reputation.cleanCycles(idKey) < minScore) revert BelowMinScore();
        if (!acceptDefaulted && reputation.hasDefaulted(idKey)) revert HasDefaulted();

        token.safeTransferFrom(msg.sender, address(this), collateralReq);

        members.push(
            Member({
                wallet: msg.sender,
                idKey: idKey,
                collateral: collateralReq,
                hasReceivedPot: false,
                active: true,
                defaultedThisCycle: false
            })
        );
        uint256 slot = members.length - 1;
        slotOfPlusOne[msg.sender] = slot + 1;

        emit MemberJoined(poolId, msg.sender, idKey, slot, identityGate.isLiveGate());

        if (members.length == memberCount) _lock();
    }

    /// @notice Cancel a pool that never filled and refund all collateral. Creator only, while OPEN.
    function cancel() external {
        if (status != Status.OPEN) revert WrongStatus();
        require(msg.sender == creator, "only creator");
        status = Status.CANCELLED;
        uint256 n = members.length;
        for (uint256 i = 0; i < n; i++) {
            uint256 amt = members[i].collateral;
            members[i].collateral = 0;
            if (amt > 0) token.safeTransfer(members[i].wallet, amt);
        }
        emit PoolCancelled(poolId);
    }

    // ---------------------------------------------------------------------
    // Lock + randomness seam (spec §5.4)
    // ---------------------------------------------------------------------

    function _lock() internal {
        status = Status.LOCKED;
        _requestRandomness();
    }

    /// @notice Request randomness for the payout order. Dev build fulfils synchronously with a
    ///         pseudo-random seed; the VRF build overrides this to call the coordinator.
    function _requestRandomness() internal virtual {
        uint256 seed = uint256(keccak256(abi.encode(block.prevrandao, block.timestamp, address(this))));
        _onRandomness(seed);
    }

    /// @notice Randomness callback: shuffle the payout order and start round 1.
    function _onRandomness(uint256 randomWord) internal {
        require(status == Status.LOCKED, "not locked");
        uint8 n = memberCount;
        uint8[] memory order = new uint8[](n);
        for (uint8 i = 0; i < n; i++) {
            order[i] = i;
        }
        // Fisher–Yates shuffle seeded by the random word.
        for (uint8 i = n - 1; i > 0; i--) {
            // j in [0, i], so it always fits in uint8 (i < n <= 255).
            uint8 j = uint8(uint256(keccak256(abi.encode(randomWord, i))) % (i + 1));
            (order[i], order[j]) = (order[j], order[i]);
        }
        payoutOrder = order;

        status = Status.ROUND_ACTIVE;
        currentRound = 1;
        roundEndsAt = block.timestamp + periodSeconds;
        windowEndsAt = block.timestamp + windowSeconds;
        emit CycleStarted(poolId, order);
    }

    // ---------------------------------------------------------------------
    // Round play (spec §5.4 Q4 / §5.5)
    // ---------------------------------------------------------------------

    /// @notice Pay this round's contribution. Must be within the payment window.
    function contribute() external {
        if (status != Status.ROUND_ACTIVE) revert WrongStatus();
        uint256 slotPlus = slotOfPlusOne[msg.sender];
        if (slotPlus == 0) revert NotAMember();
        if (block.timestamp > windowEndsAt) revert WindowClosed();
        uint256 slot = slotPlus - 1;
        if (paid[currentRound][slot]) revert AlreadyPaidThisRound();

        paid[currentRound][slot] = true;
        token.safeTransferFrom(msg.sender, address(this), contribution);
        emit ContributionPaid(poolId, currentRound, slot);
    }

    /// @notice Settle the current round (slash misses, pay the winner) and advance.
    ///         Permissionless — anyone (or Chainlink Automation) may call once the window closes.
    function settleRound() public {
        if (status != Status.ROUND_ACTIVE) revert WrongStatus();
        if (block.timestamp <= windowEndsAt) revert NotYetTimeToAdvance();

        uint8 round = currentRound;

        // 1. Slash defaulters (unpaid active members).
        uint256 n = members.length;
        for (uint256 i = 0; i < n; i++) {
            Member storage m = members[i];
            if (!m.active) continue;
            if (paid[round][i]) continue;

            // Missed this round — slash one contribution from collateral.
            uint256 slash = contribution;
            if (slash > m.collateral) slash = m.collateral;
            m.collateral -= slash;
            emit MemberSlashed(poolId, round, i, slash, m.collateral);

            if (!m.defaultedThisCycle) {
                m.defaultedThisCycle = true;
                reputation.recordDefault(m.idKey);
            }
            // Eject if collateral can no longer cover a future slash.
            if (m.collateral < contribution) {
                m.active = false;
                emit MemberEjected(poolId, i);
            }
        }

        // 2. Pay the winner the full pot (funded by contributions + slashed collateral).
        uint256 winnerSlot = payoutOrder[round - 1];
        Member storage winner = members[winnerSlot];
        winner.hasReceivedPot = true;
        token.safeTransfer(winner.wallet, pot);
        emit PotPaid(poolId, round, winnerSlot, pot);

        // 3. Advance or complete.
        if (round < memberCount) {
            currentRound = round + 1;
            roundEndsAt = block.timestamp + periodSeconds;
            windowEndsAt = block.timestamp + windowSeconds;
            emit RoundAdvanced(poolId, currentRound);
        } else {
            _settle();
        }
    }

    // ---------------------------------------------------------------------
    // Final settlement (spec §5.6)
    // ---------------------------------------------------------------------

    function _settle() internal {
        status = Status.COMPLETE;

        uint256 protocolFee = (pot * PROTOCOL_FEE_BPS) / 10_000;
        uint256 creatorFee = inviteOnly ? (pot * CREATOR_FEE_BPS) / 10_000 : 0;

        uint256 n = members.length;
        for (uint256 i = 0; i < n; i++) {
            Member storage m = members[i];

            // Reputation: clean cycle only if never defaulted this cycle.
            if (!m.defaultedThisCycle) {
                reputation.recordCleanCycle(m.idKey);
            }

            // Return remaining collateral minus this member's fee share.
            uint256 feeShare = protocolFee / memberCount;
            if (inviteOnly && m.wallet != creator) {
                feeShare += creatorFee / memberCount;
            }
            uint256 refund = m.collateral;
            if (feeShare > refund) feeShare = refund; // never underflow on a slashed-thin member
            refund -= feeShare;
            m.collateral = 0;
            if (refund > 0) token.safeTransfer(m.wallet, refund);
        }

        // Pay out accumulated fees from whatever remains in the contract.
        uint256 bal = token.balanceOf(address(this));
        if (creatorFee > 0 && bal > 0) {
            uint256 pay = creatorFee > bal ? bal : creatorFee;
            token.safeTransfer(creator, pay);
            bal -= pay;
        }
        if (bal > 0) token.safeTransfer(treasury, bal);

        emit CycleCompleted(poolId);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function memberCountJoined() external view returns (uint256) {
        return members.length;
    }

    function getPayoutOrder() external view returns (uint8[] memory) {
        return payoutOrder;
    }

    function getMember(uint256 slot) external view returns (Member memory) {
        return members[slot];
    }
}
