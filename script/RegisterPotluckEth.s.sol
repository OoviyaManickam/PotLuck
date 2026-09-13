// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

/// @title RegisterPotluckEth
/// @notice PHASE 1 of ENS go-live: register `potluck.eth` on the ENSv2 Sepolia BETA registrar,
///         attaching PotLuck's own child registry + custom resolver AT REGISTRATION TIME.
///
///         ENSv2-beta registration is a two-transaction commit->reveal:
///           1. commit(makeCommitment(...))         — hides the label for >= MIN_COMMITMENT_AGE (60s)
///           2. wait >= 60s (and < MAX_COMMITMENT_AGE = 86400s)
///           3. register(...)                        — pays ~8 USDC, mints potluck.eth
///
///         BOTH calls must use IDENTICAL (owner, secret, subregistry, resolver, duration, roleBitmap)
///         or the commitment hash won't match and register() reverts. So the subregistry + resolver
///         must ALREADY be deployed (Phase 2) before running this. Run Phase 2 first.
///
///         Because a commit needs a real >=60s wait, this script has TWO entrypoints you run
///         separately, not one run() — a single broadcast can't sleep between two mined txs:
///           forge script script/RegisterPotluckEth.s.sol:RegisterPotluckEth --sig "commitStep()"  --rpc-url "$RPC" --broadcast
///           (wait ~70s)
///           forge script script/RegisterPotluckEth.s.sol:RegisterPotluckEth --sig "registerStep()" --rpc-url "$RPC" --broadcast
///
///         Env required (set in YOUR shell — never commit these):
///           PRIVATE_KEY        MEMBER1 deployer key (the ENS owner + payer)
///           POTLUCK_SUBREGISTRY  PotluckSubRegistry for the `potluck` node (from Phase 2 output)
///           REPUTATION_RESOLVER  ReputationResolver address           (from Phase 2 output)
///           ENS_SECRET         any bytes32 you pick; MUST be the SAME value for both steps
///                              (e.g. export ENS_SECRET=0x<32 random bytes>)
///         Optional:
///           REG_DURATION       seconds; default 31536000 (1yr). Must be >= MIN_REGISTER_DURATION (28d).
///
///         The registrar pulls the ~8 USDC fee via transferFrom, so BEFORE registerStep() you must
///         approve the registrar to spend USDC (one-time, done in the runbook, not here).
contract RegisterPotluckEth is Script {
    // ENSv2 Sepolia beta — verified on-chain (see docs/ENS_LAB_NOTEBOOK.md).
    address constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;

    string constant LABEL = "potluck";

    // Role bitmap the OWNER (MEMBER1) receives on the potluck node: permission to change the
    // subregistry and the resolver later. Values from the spike / permissioned-registry docs.
    uint256 constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 constant ROLE_SET_RESOLVER = 1 << 24;

    function _owner() internal view returns (address) {
        return vm.addr(vm.envUint("PRIVATE_KEY"));
    }

    function _duration() internal view returns (uint64) {
        return uint64(vm.envOr("REG_DURATION", uint256(31536000)));
    }

    function _secret() internal view returns (bytes32) {
        return vm.envBytes32("ENS_SECRET");
    }

    function _subregistry() internal view returns (address) {
        return vm.envAddress("POTLUCK_SUBREGISTRY");
    }

    function _resolver() internal view returns (address) {
        return vm.envAddress("REPUTATION_RESOLVER");
    }

    /// @notice Roles arg is bytes32 on the REGISTRAR (differs from the registry's uint256 — see notebook).
    function _roleBitmap() internal pure returns (bytes32) {
        return bytes32(ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER);
    }

    /// STEP 1 — broadcast the commitment. Prints the commitment hash for your records.
    function commitStep() external {
        address owner = _owner();
        bytes32 secret = _secret();
        address sub = _subregistry();
        address resolver = _resolver();
        uint64 duration = _duration();
        bytes32 roles = _roleBitmap();

        (bool ok, bytes memory ret) = ETH_REGISTRAR.staticcall(
            abi.encodeWithSignature(
                "makeCommitment(string,address,bytes32,address,address,uint64,bytes32)",
                LABEL, owner, secret, sub, resolver, duration, roles
            )
        );
        require(ok, "makeCommitment failed");
        bytes32 commitment = abi.decode(ret, (bytes32));

        console2.log("== Phase 1 / commitStep ==");
        console2.log("owner (MEMBER1)   :", owner);
        console2.log("subregistry       :", sub);
        console2.log("resolver          :", resolver);
        console2.log("duration (s)      :", duration);
        console2.logBytes32(commitment);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        (bool sent, ) = ETH_REGISTRAR.call(abi.encodeWithSignature("commit(bytes32)", commitment));
        require(sent, "commit failed");
        vm.stopBroadcast();

        console2.log(">> Commit sent. Wait >= 60s (and < 86400s), then run registerStep().");
    }

    /// STEP 2 — broadcast the paid registration. Uses the SAME args as the commit.
    /// The registrar pulls ~8 USDC via transferFrom; you must have approved it first (see runbook).
    function registerStep() external {
        address owner = _owner();
        bytes32 secret = _secret();
        address sub = _subregistry();
        address resolver = _resolver();
        uint64 duration = _duration();
        bytes32 roles = _roleBitmap();
        address referrer = address(0);

        console2.log("== Phase 1 / registerStep ==");
        console2.log("Registering potluck.eth to:", owner);

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        (bool sent, bytes memory ret) = ETH_REGISTRAR.call(
            abi.encodeWithSignature(
                "register(string,address,bytes32,address,address,uint64,address,bytes32)",
                LABEL, owner, secret, sub, resolver, duration, referrer, roles
            )
        );
        require(sent, "register failed (check commit age, USDC approval, availability)");
        vm.stopBroadcast();

        uint256 tokenId = ret.length >= 32 ? abi.decode(ret, (uint256)) : 0;
        console2.log("registered. tokenId:", tokenId);
        console2.log(">> potluck.eth is now owned by MEMBER1 with your resolver + subregistry attached.");
    }
}
