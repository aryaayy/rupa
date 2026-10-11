// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "@openzeppelin/contracts/utils/cryptography/P256.sol";
import {WebAuthnLib} from "./lib/WebAuthnLib.sol";

/// @notice Owner-bound approval keys. The bound ledger MUST reconstruct the approval hash from live state.
contract PasskeyApprover {
    struct Key {
        uint256 qx;
        uint256 qy;
        bytes32 credIdHash;
    }

    error Unauthorized();
    error InvalidConfiguration();
    error LedgerAlreadyBound();
    error InvalidKey();
    error AlreadyRegistered();
    error NoPasskey();
    error DeadlineExpired();
    error InvalidAssertion();

    mapping(address owner => Key key) public keyOf;
    mapping(address owner => uint256 nonce) public nonces;
    bytes32 public immutable RP_ID_HASH;
    address public immutable binder;
    string public allowedOrigin;
    address public ledger;

    event LedgerBound(address indexed ledger);
    event PasskeyRegistered(address indexed owner, bytes32 credIdHash, uint256 qx, uint256 qy);
    event PasskeyRotated(address indexed owner, bytes32 credIdHash, uint256 qx, uint256 qy);

    constructor(bytes32 rpIdHash, string memory origin, address initialBinder) {
        bytes memory raw = bytes(origin);
        if (rpIdHash == bytes32(0) || initialBinder == address(0) || raw.length == 0 || raw.length > 256) {
            revert InvalidConfiguration();
        }
        for (uint256 i; i < raw.length; ++i) {
            if (uint8(raw[i]) < 0x21 || uint8(raw[i]) > 0x7e || raw[i] == '"' || raw[i] == "\\") {
                revert InvalidConfiguration();
            }
        }
        RP_ID_HASH = rpIdHash;
        allowedOrigin = origin;
        binder = initialBinder;
    }

    function bindLedger(address ledger_) external {
        if (msg.sender != binder) revert Unauthorized();
        if (ledger != address(0)) revert LedgerAlreadyBound();
        if (ledger_.code.length == 0) revert InvalidConfiguration();
        ledger = ledger_;
        emit LedgerBound(ledger_);
    }

    function registerPasskey(uint256 qx, uint256 qy, bytes32 credIdHash) external {
        if (keyOf[msg.sender].credIdHash != bytes32(0)) revert AlreadyRegistered();
        _setKey(qx, qy, credIdHash);
        emit PasskeyRegistered(msg.sender, credIdHash, qx, qy);
    }

    function rotatePasskey(uint256 qx, uint256 qy, bytes32 credIdHash) external {
        if (keyOf[msg.sender].credIdHash == bytes32(0)) revert NoPasskey();
        _setKey(qx, qy, credIdHash);
        // Invalidates outstanding approvals even if the owner selects the same key again.
        ++nonces[msg.sender];
        emit PasskeyRotated(msg.sender, credIdHash, qx, qy);
    }

    function verifyApproval(
        address owner,
        bytes32 approvalHash,
        uint64 deadline,
        WebAuthnLib.Assertion calldata a
    ) external returns (bool) {
        if (msg.sender != ledger) revert Unauthorized();
        if (block.timestamp > deadline) revert DeadlineExpired();
        Key memory key = keyOf[owner];
        if (key.credIdHash == bytes32(0)) revert NoPasskey();
        if (!WebAuthnLib.verify(approvalHash, RP_ID_HASH, allowedOrigin, key.qx, key.qy, a)) {
            revert InvalidAssertion();
        }
        ++nonces[owner];
        return true;
    }

    function _setKey(uint256 qx, uint256 qy, bytes32 credIdHash) private {
        if (credIdHash == bytes32(0) || !P256.isValidPublicKey(bytes32(qx), bytes32(qy))) {
            revert InvalidKey();
        }
        keyOf[msg.sender] = Key(qx, qy, credIdHash);
    }
}
