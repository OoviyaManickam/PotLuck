// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {IPermissionedRegistry, IRegistry} from "../../src/interfaces/IENSv2.sol";
import {PotluckSubRegistry} from "../../src/naming/PotluckSubRegistry.sol";
import {PotluckENS} from "../../src/naming/PotluckENS.sol";
import {ReputationResolver} from "../../src/naming/ReputationResolver.sol";
import {ReputationRegistry} from "../../src/ReputationRegistry.sol";
import {ROSCAFactory} from "../../src/ROSCAFactory.sol";
import {ROSCAPool} from "../../src/ROSCAPool.sol";
import {NoOpGate} from "../../src/identity/NoOpGate.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

interface IUniversalResolverV2 {
    function resolve(bytes calldata name, bytes calldata data)
        external view returns (bytes memory result, address resolver);
    function findResolver(bytes calldata name)
        external view returns (address resolver, bytes32 node, uint256 offset);
}

contract PotluckEnsForkTest is Test {
    address constant ETH_REGISTRY = 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2;
    address constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;
    address constant URV2 = 0x4A1817d13E9cF196f471725176355C1234b63C70;

    uint256 constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 constant ROLE_SET_RESOLVER = 1 << 24;
    bytes4 constant TEXT_SELECTOR = 0x59d1d43c;

    IPermissionedRegistry ethRegistry = IPermissionedRegistry(ETH_REGISTRY);
    IUniversalResolverV2 urv2 = IUniversalResolverV2(URV2);

    address owner = makeAddr("potluckOwner");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");

    MockUSDC token;
    NoOpGate gate;
    ROSCAFactory factory;
    ReputationRegistry registry;
    PotluckENS ens;
    ReputationResolver resolver;
    PotluckSubRegistry potluckReg;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));

        token = new MockUSDC();
        gate = new NoOpGate();

        // Deploy factory (NoOpNaming = address(0) initially), then registry, then wire it.
        factory = new ROSCAFactory(address(token), address(gate), address(0), treasury);
        registry = new ReputationRegistry(address(factory));
        factory.setRegistry(address(registry));

        // ENS stack — deploy PotluckENS EXACTLY ONCE (Correction A). No cycle exists because
        // PotluckENS never holds the resolver; the resolver is wired at potluck.eth directly
        // via the registrar register call below.
        ens = new PotluckENS(address(factory), ETH_REGISTRY);
        potluckReg = new PotluckSubRegistry(address(ens));
        resolver = new ReputationResolver(address(ens), address(registry));
        ens.initPotluckRegistry(address(potluckReg), "potluck", uint64(block.timestamp + 365 days));
        factory.setNaming(address(ens));

        // Mint potluck.eth FREE, pointing at our potluck child registry + our resolver.
        uint256 roles = ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER;
        vm.prank(ETH_REGISTRAR);
        ethRegistry.register(
            "potluck", owner, IRegistry(address(potluckReg)), address(resolver), roles, uint64(block.timestamp + 365 days)
        );
    }

    function test_endToEnd_liveReputation_and_roleModel() public {
        // 1. Create a pool (poolId 0) and join alice — this runs PotluckENS for real.
        ROSCAFactory.PoolConfig memory cfg = ROSCAFactory.PoolConfig({
            contribution: 10e6, memberCount: 3, periodSeconds: 1 days,
            windowSeconds: 12 hours, minScore: 0, acceptDefaulted: true, inviteOnly: false
        });
        vm.prank(alice);
        address poolAddr = factory.createPool(cfg, "");
        ROSCAPool pool = ROSCAPool(poolAddr);

        token.mint(alice, 1_000e6);
        vm.startPrank(alice);
        token.approve(poolAddr, type(uint256).max);
        pool.join("");
        vm.stopPrank();

        // 2. Resolve alice's subname through the REAL UniversalResolverV2.
        // The real URv2 passes the text() calldata through to resolve(name, data) VERBATIM — it
        // does NOT substitute the traversal node into the text() `node` arg. Our resolver reads
        // idKeyOf[node] from that arg, so we must pass the ACTUAL member namehash (the same value
        // PotluckENS recorded at registerMember). memberNameHash uses the standard recursive
        // namehash, which is exactly the node URv2 computes for the name.
        bytes memory dnsName = _dnsMemberName(alice); // <alicehex>.pool0.potluck.eth
        bytes32 node = ens.memberNameHash(0, alice);
        bytes memory textCall = abi.encodeWithSelector(TEXT_SELECTOR, node, "potluck.reputation");

        (address found, bytes32 urNode,) = urv2.findResolver(dnsName);
        console2.log("URv2 node:");
        console2.logBytes32(urNode);
        console2.log("ens memberNameHash:");
        console2.logBytes32(node);
        assertEq(found, address(resolver), "URv2 did not route to our resolver");
        assertEq(urNode, node, "namehash disagreement: URv2 node != memberNameHash");

        (bytes memory out,) = urv2.resolve(dnsName, textCall);
        string memory v1 = abi.decode(out, (string));
        console2.log("live before:", v1);
        assertEq(v1, "cleanCycles=0;defaulted=false;tier=New");

        // 3. Mutate reputation on-chain, re-resolve, confirm it changed (proves LIVE, not stored).
        bytes32 idKey = keccak256(abi.encode(alice)); // NoOpGate idKey formula
        vm.prank(address(factory));
        registry.authorizePool(address(this));
        registry.recordCleanCycle(idKey);
        registry.recordCleanCycle(idKey);
        registry.recordCleanCycle(idKey);

        (bytes memory out2,) = urv2.resolve(dnsName, textCall);
        string memory v2 = abi.decode(out2, (string));
        console2.log("live after:", v2);
        assertEq(v2, "cleanCycles=3;defaulted=false;tier=Silver");

        // 4. Role model: an unauthorized EOA cannot mint under potluck.eth.
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(); // registrar-only path; attacker lacks ROLE_REGISTRAR on ETHRegistry
        ethRegistry.register(
            "evil", makeAddr("attacker"), IRegistry(address(0)), address(0), 0, uint64(block.timestamp + 1 days)
        );
    }

    // DNS-encode <alicehex>.pool0.potluck.eth
    function _dnsMemberName(address member) internal view returns (bytes memory) {
        string memory m = ens.memberLabelExternal(member);
        return abi.encodePacked(
            uint8(bytes(m).length), m,
            uint8(5), "pool0",
            uint8(7), "potluck",
            uint8(3), "eth",
            uint8(0)
        );
    }
}
