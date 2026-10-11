// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library ApprovalHash {
    function compute(
        uint256 chainId,
        address ledger,
        address owner,
        uint256 assetId,
        uint32 targetAppId,
        bytes32 mappingId,
        uint256 nonce,
        uint64 deadline
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                "RUPA_PORT_V1", chainId, ledger, owner, assetId, targetAppId, mappingId, nonce, deadline
            )
        );
    }
}
