// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ============================================================================
// PATH B ENS FORK SPIKE — THROWAWAY. Not production code.
//
// Goal: prove, against the REAL ENSv2 Sepolia beta contracts (forked locally),
// the two primitives our PotLuck hierarchy depends on:
//
//   Goal 3 — hierarchy:  potluck.eth -> pool1.potluck.eth -> alice.pool1.potluck.eth
//   Goal 4 — routing:    a custom resolver WE control is reached by the real
//                        UniversalResolverV2 when it walks that name, and it
//                        returns a live-computed reputation record.
//
// How it stays free (no USDC paywall): the paywall lives in the ETHRegistrar,
// not the ETHRegistry. The ETHRegistrar holds ROLE_REGISTRAR on the ETHRegistry
// (verified on-chain). So on a fork we vm.prank(REGISTRAR) and call the
// ETHRegistry's register() directly — same code path a paid registration hits,
// minus the payment step.
//
// We deploy only two tiny throwaway contracts: a minimal child IRegistry and a
// custom ENSIP-10 resolver. Everything else (RootRegistry, ETHRegistry,
// UniversalResolverV2, NameCoder logic) is the real deployed ENS code.
// ============================================================================

import {Test, console2} from "forge-std/Test.sol";

// --- Minimal real-ENS interfaces (hand-declared to avoid recompiling the whole
//     contracts-v2 tree with its conflicting nested remappings). Signatures were
//     verified against lib/contracts-v2 source and on-chain selector probes. ---

interface IRegistry {
    function getSubregistry(string calldata label) external view returns (IRegistry);
    function getResolver(string calldata label) external view returns (address);
    function getParent() external view returns (IRegistry parent, string memory label);
}

/// The subset of PermissionedRegistry we exercise. `register` returns the tokenId;
/// `anyId` for setSubregistry/setResolver is the labelhash (LibLabel.id(label) == keccak256(label)).
interface IPermissionedRegistry is IRegistry {
    function register(
        string calldata label,
        address owner,
        IRegistry subregistry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    function setSubregistry(uint256 anyId, IRegistry registry) external;
    function setResolver(uint256 anyId, address resolver) external;

    function grantRoles(uint256 anyId, uint256 roleBitmap, address account) external returns (bool);
    function hasRootRoles(uint256 roleBitmap, address account) external view returns (bool);
}

/// UniversalResolverV2 — ENSIP-10 entrypoint. resolve returns (result, resolverAddress).
interface IUniversalResolverV2 {
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory result, address resolver);

    function findResolver(bytes calldata name)
        external
        view
        returns (address resolver, bytes32 node, uint256 offset);

    function ROOT_REGISTRY() external view returns (address);
}

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

// ---------------------------------------------------------------------------
// Throwaway child registry: the minimum an IRegistry needs so the real URv2's
// LibRegistry.findResolver can walk THROUGH it. It only ever gets asked
// getSubregistry / getResolver / getParent during a resolve() traversal.
// ---------------------------------------------------------------------------
contract MiniRegistry is IRegistry {
    mapping(bytes32 => IRegistry) internal _sub;
    mapping(bytes32 => address) internal _resolver;
    IRegistry internal _parent;
    string internal _label;

    function setSub(string calldata label, IRegistry r) external {
        _sub[keccak256(bytes(label))] = r;
    }

    function setResolverFor(string calldata label, address r) external {
        _resolver[keccak256(bytes(label))] = r;
    }

    function setParent(IRegistry parent, string calldata label) external {
        _parent = parent;
        _label = label;
    }

    function getSubregistry(string calldata label) external view returns (IRegistry) {
        return _sub[keccak256(bytes(label))];
    }

    function getResolver(string calldata label) external view returns (address) {
        return _resolver[keccak256(bytes(label))];
    }

    function getParent() external view returns (IRegistry, string memory) {
        return (_parent, _label);
    }
}

// ---------------------------------------------------------------------------
// Throwaway custom resolver: the shape our real reputation resolver will take.
// Implements ENSIP-10 resolve(name, data). For the spike it decodes a text()
// request and returns a LIVE-COMPUTED value (not a stored placeholder), proving
// dynamic records are servable and that URv2 actually routed here.
// ---------------------------------------------------------------------------
contract RepResolver is IExtendedResolver, IERC165 {
    // text(bytes32 node, string key) selector, the classic profile call URv2 wraps.
    bytes4 internal constant TEXT_SELECTOR = 0x59d1d43c;

    // Pretend on-chain reputation source. In production this reads the real
    // ReputationRegistry keyed by the resolved name/owner.
    uint256 public cleanCycles = 3;
    bool public defaulted = false;

    event Resolved(bytes name, bytes4 selector);

    /// CRITICAL: the resolver MUST advertise IExtendedResolver via ERC-165, or the real
    /// UniversalResolverV2._checkResolver treats it as a legacy exact-match resolver and
    /// reverts ResolverNotFound for any inherited (wildcard) lookup. This is what makes
    /// an ancestor resolver (set at potluck.eth) serve descendants (alice.pool1.potluck.eth).
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }

    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        bytes4 sel = bytes4(data[:4]);
        if (sel == TEXT_SELECTOR) {
            // decode (node, key) — we ignore node, key drives the record.
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            string memory value = _record(key);
            return abi.encode(value);
        }
        // unsupported profile -> empty
        return "";
    }

    function _record(string memory key) internal view returns (string memory) {
        if (_eq(key, "potluck.reputation")) {
            return string.concat(
                "cleanCycles=",
                _u(cleanCycles),
                ";defaulted=",
                defaulted ? "true" : "false"
            );
        }
        return "";
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _u(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        bytes memory b;
        while (v > 0) {
            b = abi.encodePacked(uint8(48 + (v % 10)), b);
            v /= 10;
        }
        return string(b);
    }
}

contract EnsHierarchySpike is Test {
    // Real ENSv2 Sepolia beta addresses (verified on-chain, notebook Entry 2).
    address constant ETH_REGISTRY = 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2;
    address constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;
    address constant URV2 = 0x4A1817d13E9cF196f471725176355C1234b63C70;

    // RegistryRolesLib constants (from source).
    uint256 constant ROLE_REGISTRAR = 1 << 0;
    uint256 constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 constant ROLE_SET_RESOLVER = 1 << 24;

    IPermissionedRegistry ethRegistry = IPermissionedRegistry(ETH_REGISTRY);
    IUniversalResolverV2 urv2 = IUniversalResolverV2(URV2);

    address owner = makeAddr("potluckOwner");

    function setUp() public {
        // Fork Sepolia at latest. Requires SEPOLIA_RPC_URL in env.
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
    }

    function test_hierarchy_and_custom_resolver_routing() public {
        // Sanity: URv2 really points at the same root the ETHRegistry hangs off.
        console2.log("URv2 ROOT_REGISTRY:", urv2.ROOT_REGISTRY());
        assertTrue(ethRegistry.hasRootRoles(ROLE_REGISTRAR, ETH_REGISTRAR), "registrar lacks role");

        // --- STEP 1: mint potluck.eth for FREE by pranking the registrar ---
        // Grant the owner the sub/resolver-management roles so it can wire children.
        uint256 roles = ROLE_SET_SUBREGISTRY | ROLE_SET_RESOLVER;
        uint64 expiry = uint64(block.timestamp + 365 days);

        // We give potluck.eth its own child registry (a MiniRegistry) up front.
        MiniRegistry potluckReg = new MiniRegistry();
        RepResolver resolver = new RepResolver();

        vm.prank(ETH_REGISTRAR);
        ethRegistry.register("potluck", owner, potluckReg, address(resolver), roles, expiry);

        // potluck.eth now resolves to our child registry + our custom resolver.
        assertEq(address(ethRegistry.getSubregistry("potluck")), address(potluckReg), "sub not set");
        assertEq(ethRegistry.getResolver("potluck"), address(resolver), "resolver not set");
        console2.log("STEP 1 ok: potluck.eth minted, child registry + custom resolver attached");

        // --- STEP 2: build the deeper hierarchy inside our own registries ---
        // pool1.potluck.eth -> its own registry; alice.pool1.potluck.eth under that.
        MiniRegistry pool1Reg = new MiniRegistry();
        potluckReg.setSub("pool1", pool1Reg);
        potluckReg.setParent(ethRegistry, "potluck");
        pool1Reg.setParent(potluckReg, "pool1");
        // alice exists as a leaf under pool1 (no deeper registry needed).
        // No resolver set at pool1 or alice -> they INHERIT potluck.eth's resolver
        // via LibRegistry.findResolver's walk. That inheritance IS wildcard resolution.
        console2.log("STEP 2 ok: pool1.potluck.eth and alice.pool1.potluck.eth wired");

        // --- STEP 3: route a real lookup through the real UniversalResolverV2 ---
        // DNS-encode alice.pool1.potluck.eth and ask URv2 to resolve a text record.
        bytes memory dnsName = _dnsEncode3("alice", "pool1", "potluck");
        bytes memory textCall = abi.encodeWithSelector(
            0x59d1d43c, // text(bytes32,string)
            bytes32(0), // node (resolver ignores; URv2 rewrites)
            "potluck.reputation"
        );

        // First confirm findResolver reaches OUR resolver by inheritance.
        (address foundResolver,,) = urv2.findResolver(dnsName);
        console2.log("findResolver -> ", foundResolver);
        assertEq(foundResolver, address(resolver), "URv2 did not route to our resolver");

        (bytes memory result, address usedResolver) = urv2.resolve(dnsName, textCall);
        assertEq(usedResolver, address(resolver), "resolve used a different resolver");
        string memory value = abi.decode(result, (string));
        console2.log("LIVE record for alice.pool1.potluck.eth [potluck.reputation]:", value);
        assertEq(value, "cleanCycles=3;defaulted=false", "unexpected live record");

        console2.log("STEP 3 ok: real URv2 routed to our resolver and returned a live record");
    }

    // DNS-encode a 3-label name + .eth: len|label ... |0x03 e t h|0x00
    function _dnsEncode3(string memory a, string memory b, string memory c)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodePacked(
            uint8(bytes(a).length), a,
            uint8(bytes(b).length), b,
            uint8(bytes(c).length), c,
            uint8(3), "eth",
            uint8(0)
        );
    }
}
