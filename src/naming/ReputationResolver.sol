// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IExtendedResolver} from "../interfaces/IENSv2.sol";
import {ReputationRegistry} from "../ReputationRegistry.sol";
import {Tiers} from "../Tiers.sol";

/// @notice name(hash) -> reputation idKey. Implemented by PotluckENS (records the map at mint).
interface INameKey {
    function idKeyOf(bytes32 nameHash) external view returns (bytes32);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title ReputationResolver
/// @notice Custom ENSIP-10 resolver set ONCE at potluck.eth; every descendant inherits it via
///         wildcard resolution. It answers the `potluck.reputation` text record with the member's
///         LIVE reputation, read from ReputationRegistry at resolution time. Spec §3/§4.
/// @dev MUST advertise IExtendedResolver via ERC-165 or UniversalResolverV2._checkResolver
///      reverts ResolverNotFound for inherited lookups (proven in the spike).
contract ReputationResolver is IExtendedResolver, IERC165 {
    bytes4 internal constant TEXT_SELECTOR = 0x59d1d43c; // text(bytes32,string)

    INameKey public immutable names;
    ReputationRegistry public immutable reputation;

    constructor(address nameKeySource_, address reputation_) {
        names = INameKey(nameKeySource_);
        reputation = ReputationRegistry(reputation_);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId
            || interfaceId == type(IERC165).interfaceId;
    }

    // Minimum valid text(bytes32,string) payload:
    //   4 bytes selector + 32 bytes node + 32 bytes offset + 32 bytes string-length = 100 bytes.
    uint256 internal constant MIN_TEXT_DATA_LEN = 100;

    function resolve(bytes calldata, /* name */ bytes calldata data)
        external
        view
        returns (bytes memory)
    {
        if (data.length < 4) return abi.encode("");
        if (bytes4(data[:4]) != TEXT_SELECTOR) return abi.encode("");
        if (data.length < MIN_TEXT_DATA_LEN) return abi.encode("");
        (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));
        if (keccak256(bytes(key)) != keccak256(bytes("potluck.reputation"))) return abi.encode("");

        bytes32 idKey = names.idKeyOf(node);
        if (idKey == bytes32(0)) return abi.encode("");

        uint32 clean = reputation.cleanCycles(idKey);
        bool defaulted = reputation.hasDefaulted(idKey);
        string memory value = string.concat(
            "cleanCycles=", _u(clean),
            ";defaulted=", defaulted ? "true" : "false",
            ";tier=", _tier(Tiers.tierOf(clean))
        );
        return abi.encode(value);
    }

    function _tier(Tiers.Tier t) internal pure returns (string memory) {
        if (t == Tiers.Tier.New) return "New";
        if (t == Tiers.Tier.Bronze) return "Bronze";
        if (t == Tiers.Tier.Silver) return "Silver";
        return "Gold";
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
