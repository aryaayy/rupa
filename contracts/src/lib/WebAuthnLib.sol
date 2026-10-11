// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base64Url} from "./Base64Url.sol";

library WebAuthnLib {
    uint256 internal constant N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    uint256 internal constant HALF_N = N / 2;
    uint256 internal constant MAX_AUTH_DATA = 1024;
    uint256 internal constant MAX_CLIENT_DATA = 1024;

    struct Assertion {
        bytes authenticatorData;
        string clientDataJSON;
        uint256 challengeIndex;
        uint256 typeIndex;
        uint256 r;
        uint256 s;
    }

    /// @dev MVP accepts exact top-level browser serializations, with optional crossOrigin:false.
    /// Unknown fields/alternate serialization fail closed; never reserialize signed bytes.
    function verify(
        bytes32 challenge,
        bytes32 rpIdHash,
        string memory origin,
        uint256 qx,
        uint256 qy,
        Assertion calldata a
    ) internal view returns (bool) {
        if (a.authenticatorData.length < 37 || a.authenticatorData.length > MAX_AUTH_DATA) {
            return false;
        }
        if (bytes32(a.authenticatorData[:32]) != rpIdHash) return false;
        uint8 flags = uint8(a.authenticatorData[32]);
        if ((flags & 0x05) != 0x05) return false;
        // Backup State may only be set when Backup Eligibility is also set.
        if ((flags & 0x10) != 0 && (flags & 0x08) == 0) return false;
        if (a.typeIndex != 1 || a.challengeIndex != 23) return false;
        bytes memory client = bytes(a.clientDataJSON);
        if (client.length > MAX_CLIENT_DATA) return false;
        bytes memory prefix = abi.encodePacked(
            '{"type":"webauthn.get","challenge":"', Base64Url.encode(challenge), '","origin":"', origin, '"'
        );
        bytes32 clientHash = keccak256(client);
        if (
            clientHash != keccak256(abi.encodePacked(prefix, "}"))
                && clientHash != keccak256(abi.encodePacked(prefix, ',"crossOrigin":false}'))
        ) return false;
        if (a.r == 0 || a.r >= N || a.s == 0 || a.s > HALF_N) return false;

        bytes32 digest = sha256(abi.encodePacked(a.authenticatorData, sha256(client)));
        (bool success, bytes memory result) =
            address(0x0100).staticcall(abi.encodePacked(digest, a.r, a.s, qx, qy));
        return success && result.length == 32 && abi.decode(result, (uint256)) == 1;
    }
}
