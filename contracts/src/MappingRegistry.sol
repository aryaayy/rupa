// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {AppRegistry} from "./AppRegistry.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

contract MappingRegistry is EIP712 {
    struct Mapping {
        bytes32 assetType;
        uint32 targetAppId;
        uint64 targetSchemaVersion;
        uint256 agentId;
        bytes32 contentHash;
        string contentURI;
        uint64 createdAt;
        uint32 approvals;
        bool revoked;
    }

    error Unauthorized();
    error InvalidMapping();
    error SchemaOutdated();
    error InvalidAgentSignature();
    error LedgerAlreadyBound();
    error DuplicateMapping();

    bytes32 public constant MAPPING_TYPEHASH = keccak256(
        "Mapping(bytes32 assetType,uint32 targetAppId,uint64 schemaVersion,uint256 agentId,bytes32 contentHash)"
    );
    AppRegistry public immutable appRegistry;
    IIdentityRegistry public immutable identityRegistry;
    address public immutable binder;
    address public ledger;
    mapping(bytes32 mappingId => Mapping data) private _mappings;
    mapping(bytes32 pair => bytes32 mappingId) public activeMapping;

    event MappingProposed(
        bytes32 indexed mappingId,
        bytes32 indexed assetType,
        uint32 indexed targetAppId,
        uint256 agentId,
        bytes32 contentHash,
        string contentURI
    );
    event MappingActivated(bytes32 indexed mappingId, bytes32 indexed assetType, uint32 indexed targetAppId);
    event MappingRevoked(bytes32 indexed mappingId);
    event LedgerBound(address indexed ledger);

    constructor(AppRegistry apps, IIdentityRegistry identity, address initialBinder) EIP712("Rupa", "1") {
        if (address(apps) == address(0) || address(identity) == address(0) || initialBinder == address(0)) {
            revert InvalidMapping();
        }
        appRegistry = apps;
        identityRegistry = identity;
        binder = initialBinder;
    }

    function bindLedger(address ledger_) external {
        if (msg.sender != binder) revert Unauthorized();
        if (ledger != address(0)) revert LedgerAlreadyBound();
        if (ledger_.code.length == 0) revert InvalidMapping();
        ledger = ledger_;
        emit LedgerBound(ledger_);
    }

    function proposeMapping(
        bytes32 assetType,
        uint32 targetAppId,
        uint64 schemaVersion,
        uint256 agentId,
        bytes32 contentHash,
        string calldata contentURI,
        bytes calldata agentSig
    ) external returns (bytes32 mappingId) {
        if (
            assetType == bytes32(0) || contentHash == bytes32(0) || bytes(contentURI).length == 0
                || bytes(contentURI).length > 2048
        ) revert InvalidMapping();
        if (appRegistry.version(targetAppId) != schemaVersion) revert SchemaOutdated();
        address agentOwner = identityRegistry.ownerOf(agentId);
        address signer = identityRegistry.getAgentWallet(agentId);
        if (signer == address(0)) signer = agentOwner;
        if (
            signer == address(0)
                || !SignatureChecker.isValidSignatureNow(
                    signer,
                    proposalDigest(assetType, targetAppId, schemaVersion, agentId, contentHash),
                    agentSig
                )
        ) revert InvalidAgentSignature();
        mappingId = keccak256(abi.encode(assetType, targetAppId, schemaVersion, contentHash));
        if (_mappings[mappingId].targetSchemaVersion != 0) revert DuplicateMapping();
        _mappings[mappingId] = Mapping(
            assetType,
            targetAppId,
            schemaVersion,
            agentId,
            contentHash,
            contentURI,
            uint64(block.timestamp),
            0,
            false
        );
        emit MappingProposed(mappingId, assetType, targetAppId, agentId, contentHash, contentURI);
    }

    function proposalDigest(
        bytes32 assetType,
        uint32 targetAppId,
        uint64 schemaVersion,
        uint256 agentId,
        bytes32 contentHash
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(MAPPING_TYPEHASH, assetType, targetAppId, schemaVersion, agentId, contentHash)
            )
        );
    }

    function mappings(bytes32 mappingId) external view returns (Mapping memory) {
        return _mappings[mappingId];
    }

    function isUsable(bytes32 mappingId, bytes32 assetType, uint32 targetAppId) public view returns (bool) {
        Mapping storage data = _mappings[mappingId];
        return data.targetSchemaVersion != 0 && !data.revoked && data.assetType == assetType
            && data.targetAppId == targetAppId && data.targetSchemaVersion == appRegistry.version(targetAppId);
    }

    function setActive(bytes32 assetType, uint32 targetAppId, bytes32 mappingId) external {
        if (msg.sender != appRegistry.admin(targetAppId)) revert Unauthorized();
        if (!isUsable(mappingId, assetType, targetAppId)) revert InvalidMapping();
        _activate(mappingId);
    }

    function noteApproval(bytes32 mappingId) external {
        if (msg.sender != ledger) revert Unauthorized();
        Mapping storage data = _mappings[mappingId];
        if (!isUsable(mappingId, data.assetType, data.targetAppId)) revert InvalidMapping();
        ++data.approvals;
        bytes32 current = activeMapping[pairKey(data.assetType, data.targetAppId)];
        if (!isUsable(current, data.assetType, data.targetAppId)) _activate(mappingId);
    }

    function revokeMapping(bytes32 mappingId) external {
        Mapping storage data = _mappings[mappingId];
        if (data.targetSchemaVersion == 0) revert InvalidMapping();
        if (msg.sender != appRegistry.admin(data.targetAppId)) revert Unauthorized();
        data.revoked = true;
        bytes32 pair = pairKey(data.assetType, data.targetAppId);
        if (activeMapping[pair] == mappingId) delete activeMapping[pair];
        emit MappingRevoked(mappingId);
    }

    function pairKey(bytes32 assetType, uint32 targetAppId) public pure returns (bytes32) {
        return keccak256(abi.encode(assetType, targetAppId));
    }

    function _activate(bytes32 mappingId) private {
        Mapping storage data = _mappings[mappingId];
        activeMapping[pairKey(data.assetType, data.targetAppId)] = mappingId;
        emit MappingActivated(mappingId, data.assetType, data.targetAppId);
    }
}
