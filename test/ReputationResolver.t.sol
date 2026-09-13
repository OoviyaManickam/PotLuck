// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReputationResolver, INameKey} from "../src/naming/ReputationResolver.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";

/// Minimal name->idKey source for the unit test (PotluckENS implements this for real).
contract StubNameKey is INameKey {
    mapping(bytes32 => bytes32) public map;
    function set(bytes32 nameHash, bytes32 idKey) external { map[nameHash] = idKey; }
    function idKeyOf(bytes32 nameHash) external view returns (bytes32) { return map[nameHash]; }
}

contract ReputationResolverTest is Test {
    ReputationRegistry registry;
    StubNameKey names;
    ReputationResolver resolver;

    bytes4 constant TEXT_SELECTOR = 0x59d1d43c; // text(bytes32,string)
    bytes32 constant NODE = keccak256("alice.pool1.potluck.eth");
    bytes32 constant IDKEY = keccak256("alice-id");

    function setUp() public {
        // Registry authorises this test contract as a "pool" so we can seed reputation.
        registry = new ReputationRegistry(address(this));
        registry.authorizePool(address(this));
        names = new StubNameKey();
        names.set(NODE, IDKEY);
        resolver = new ReputationResolver(address(names), address(registry));
    }

    function test_SupportsExtendedResolverAndERC165() public view {
        assertTrue(resolver.supportsInterface(0x9061b923)); // IExtendedResolver.resolve selector-based id
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // ERC-165
    }

    function test_ResolvesLiveReputation() public {
        // Seed: 3 clean cycles, no default -> Silver.
        registry.recordCleanCycle(IDKEY);
        registry.recordCleanCycle(IDKEY);
        registry.recordCleanCycle(IDKEY);

        bytes memory data = abi.encodeWithSelector(TEXT_SELECTOR, NODE, "potluck.reputation");
        bytes memory out = resolver.resolve(_dns(), data);
        string memory value = abi.decode(out, (string));
        assertEq(value, "cleanCycles=3;defaulted=false;tier=Silver");
    }

    function test_ReflectsLaterDefaultLive() public {
        registry.recordDefault(IDKEY);
        bytes memory data = abi.encodeWithSelector(TEXT_SELECTOR, NODE, "potluck.reputation");
        string memory value = abi.decode(resolver.resolve(_dns(), data), (string));
        assertEq(value, "cleanCycles=0;defaulted=true;tier=New");
    }

    function test_UnknownKeyReturnsEmpty() public view {
        bytes memory data = abi.encodeWithSelector(TEXT_SELECTOR, NODE, "avatar");
        assertEq(abi.decode(resolver.resolve(_dns(), data), (string)), "");
    }

    function test_UnknownNameReturnsEmpty() public view {
        bytes32 unknown = keccak256("nobody.pool9.potluck.eth");
        bytes memory data = abi.encodeWithSelector(TEXT_SELECTOR, unknown, "potluck.reputation");
        assertEq(abi.decode(resolver.resolve(_dns(), data), (string)), "");
    }

    function _dns() internal pure returns (bytes memory) {
        // resolver ignores the name bytes for text(); a non-empty placeholder is fine.
        return hex"00";
    }
}
