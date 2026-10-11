// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AppRegistry} from "./AppRegistry.sol";
import {RupaAsset} from "./RupaAsset.sol";
import {MappingRegistry} from "./MappingRegistry.sol";
import {PasskeyApprover} from "./PasskeyApprover.sol";
import {WebAuthnLib} from "./lib/WebAuthnLib.sol";
import {ApprovalHash} from "./lib/ApprovalHash.sol";

contract PortLedger is Ownable, ReentrancyGuard {
    struct PortRecord {
        uint256 assetId;
        uint32 fromAppId;
        uint32 toAppId;
        bytes32 mappingId;
        uint256 agentId;
        address approver;
        uint64 at;
        bytes32 prevRecord;
    }
    error InvalidConfiguration();
    error InvalidMapping();
    error InvalidApproval();
    error InvalidFee();
    error PaymentFailed();
    error Unauthorized();
    error NotActive();
    error Paused();

    AppRegistry public immutable appRegistry;
    RupaAsset public immutable asset;
    MappingRegistry public immutable mappingRegistry;
    PasskeyApprover public immutable passkeyApprover;
    uint256 public immutable PORT_FEE;
    address public immutable feeRecipient;
    bool public paused;
    mapping(uint256 assetId => bytes32 head) public headOf;
    mapping(uint256 assetId => uint32 appId) public lastAppOf;
    mapping(uint256 assetId => mapping(uint32 appId => bytes32 mappingId)) public activeIn;

    event Ported(
        bytes32 indexed recordId,
        uint256 indexed assetId,
        uint32 indexed toAppId,
        uint32 fromAppId,
        bytes32 mappingId,
        uint256 agentId,
        address approver,
        bytes32 prevRecord
    );
    event Used(uint256 indexed assetId, uint32 indexed appId, bytes32 actionTag);
    event RoyaltyPaid(uint256 indexed assetId, uint32 indexed originAppId, address payout, uint256 amount);
    event PortFeePaid(uint256 indexed assetId, address recipient, uint256 amount);
    event PauseChanged(bool paused);

    constructor(
        AppRegistry apps,
        RupaAsset asset_,
        MappingRegistry mappings_,
        PasskeyApprover approver_,
        uint256 fee,
        address recipient,
        address pauseAdmin
    ) Ownable(pauseAdmin) {
        if (
            address(apps) == address(0) || address(asset_) == address(0) || address(mappings_) == address(0)
                || address(approver_) == address(0) || recipient == address(0)
        ) revert InvalidConfiguration();
        if (
            address(asset_.appRegistry()) != address(apps)
                || address(mappings_.appRegistry()) != address(apps)
        ) revert InvalidConfiguration();
        appRegistry = apps;
        asset = asset_;
        mappingRegistry = mappings_;
        passkeyApprover = approver_;
        PORT_FEE = fee;
        feeRecipient = recipient;
    }

    function approvalHash(uint256 assetId, uint32 targetAppId, bytes32 mappingId, uint64 deadline)
        public
        view
        returns (bytes32)
    {
        address currentOwner = asset.ownerOfAsset(assetId);
        return ApprovalHash.compute(
            block.chainid,
            address(this),
            currentOwner,
            assetId,
            targetAppId,
            mappingId,
            passkeyApprover.nonces(currentOwner),
            deadline
        );
    }

    function port(
        uint256 assetId,
        uint32 toAppId,
        bytes32 mappingId,
        uint64 deadline,
        WebAuthnLib.Assertion calldata assertion
    ) external payable nonReentrant returns (bytes32 recordId) {
        if (paused) revert Paused();
        if (msg.value != PORT_FEE) revert InvalidFee();
        RupaAsset.Base memory base = asset.getBase(assetId);
        if (!mappingRegistry.isUsable(mappingId, base.assetType, toAppId)) revert InvalidMapping();
        address currentOwner = asset.ownerOfAsset(assetId);
        if (!passkeyApprover.verifyApproval(
                currentOwner, approvalHash(assetId, toAppId, mappingId, deadline), deadline, assertion
            )) revert InvalidApproval();
        PortRecord memory record = PortRecord({
            assetId: assetId,
            fromAppId: headOf[assetId] == bytes32(0) ? base.originAppId : lastAppOf[assetId],
            toAppId: toAppId,
            mappingId: mappingId,
            agentId: mappingRegistry.mappings(mappingId).agentId,
            approver: currentOwner,
            at: uint64(block.timestamp),
            prevRecord: headOf[assetId]
        });
        recordId = keccak256(abi.encode(record));
        headOf[assetId] = recordId;
        lastAppOf[assetId] = toAppId;
        activeIn[assetId][toAppId] = mappingId;
        mappingRegistry.noteApproval(mappingId);
        emit Ported(
            recordId,
            assetId,
            toAppId,
            record.fromAppId,
            mappingId,
            record.agentId,
            currentOwner,
            record.prevRecord
        );
        _pay(assetId, base.originAppId);
    }

    function recordUse(uint256 assetId, uint32 appId, bytes32 actionTag) external {
        if (msg.sender != appRegistry.admin(appId)) revert Unauthorized();
        RupaAsset.Base memory base = asset.getBase(assetId);
        if (
            appId != base.originAppId
                && !mappingRegistry.isUsable(activeIn[assetId][appId], base.assetType, appId)
        ) revert NotActive();
        emit Used(assetId, appId, actionTag);
    }

    /// @notice Historical activation survives owner transfer, schema changes, and mapping revocation.
    function isActive(uint256 assetId, uint32 appId) external view returns (bool, bytes32 mappingId) {
        mappingId = activeIn[assetId][appId];
        return (mappingId != bytes32(0), mappingId);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseChanged(value);
    }

    function _pay(uint256 assetId, uint32 originAppId) private {
        if (PORT_FEE == 0) return;
        AppRegistry.App memory origin = appRegistry.getApp(originAppId);
        uint256 royalty = Math.mulDiv(PORT_FEE, origin.royaltyBps, 10_000);
        if (royalty != 0) {
            (bool paid,) = origin.payout.call{value: royalty}("");
            if (!paid) revert PaymentFailed();
            emit RoyaltyPaid(assetId, originAppId, origin.payout, royalty);
        }
        uint256 remainder = PORT_FEE - royalty;
        if (remainder != 0) {
            (bool paid,) = feeRecipient.call{value: remainder}("");
            if (!paid) revert PaymentFailed();
            emit PortFeePaid(assetId, feeRecipient, remainder);
        }
    }
}
