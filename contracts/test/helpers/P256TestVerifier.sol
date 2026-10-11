// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";

/// @dev LOCAL TEST ONLY. Etched at 0x0100; this is not evidence of Monad precompile support.
contract P256TestVerifier {
    fallback(bytes calldata input) external returns (bytes memory) {
        if (input.length != 160) return bytes("");
        (bytes32 digest, bytes32 r, bytes32 s, bytes32 qx, bytes32 qy) =
            abi.decode(input, (bytes32, bytes32, bytes32, bytes32, bytes32));
        return P256.verifySolidity(digest, r, s, qx, qy) ? abi.encode(uint256(1)) : bytes("");
    }
}
