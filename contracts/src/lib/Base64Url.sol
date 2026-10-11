// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Encodes exactly one bytes32 challenge, without base64 padding.
library Base64Url {
    bytes internal constant ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    function encode(bytes32 value) internal pure returns (string memory) {
        bytes memory input = abi.encodePacked(value);
        bytes memory output = new bytes(43);
        uint256 j;
        for (uint256 i; i < 30; i += 3) {
            uint256 word = (uint256(uint8(input[i])) << 16) | (uint256(uint8(input[i + 1])) << 8)
                | uint256(uint8(input[i + 2]));
            output[j++] = ALPHABET[(word >> 18) & 63];
            output[j++] = ALPHABET[(word >> 12) & 63];
            output[j++] = ALPHABET[(word >> 6) & 63];
            output[j++] = ALPHABET[word & 63];
        }
        uint256 tail = (uint256(uint8(input[30])) << 8) | uint256(uint8(input[31]));
        output[40] = ALPHABET[(tail >> 10) & 63];
        output[41] = ALPHABET[(tail >> 4) & 63];
        output[42] = ALPHABET[(tail << 2) & 63];
        return string(output);
    }
}
