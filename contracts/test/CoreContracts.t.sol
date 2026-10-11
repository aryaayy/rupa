// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AppRegistry} from "../src/AppRegistry.sol";
import {RupaAsset} from "../src/RupaAsset.sol";
import {MappingRegistry} from "../src/MappingRegistry.sol";
import {PasskeyApprover} from "../src/PasskeyApprover.sol";
import {PortLedger} from "../src/PortLedger.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {WebAuthnLib} from "../src/lib/WebAuthnLib.sol";
import {Base64Url} from "../src/lib/Base64Url.sol";
import {TestBase} from "./helpers/TestBase.sol";
import {P256TestVerifier} from "./helpers/P256TestVerifier.sol";

contract IdentityMock is IIdentityRegistry {
    address public agentOwner;
    address public agentWallet;

    constructor(address owner_) {
        agentOwner = owner_;
        agentWallet = owner_;
    }

    function ownerOf(uint256 id) external view returns (address) {
        require(id == 1, "unknown agent");
        return agentOwner;
    }

    function getAgentWallet(uint256 id) external view returns (address) {
        require(id == 1);
        return agentWallet;
    }

    function setWallet(address wallet) external {
        agentWallet = wallet;
    }
}

contract RejectPayment {
    receive() external payable {
        revert("rejected");
    }
}

contract ReentrantRecipient {
    PortLedger public ledger;
    bool public blocked;

    function configure(PortLedger ledger_) external {
        ledger = ledger_;
    }

    receive() external payable {
        WebAuthnLib.Assertion memory empty;
        (bool success, bytes memory reason) =
            address(ledger).call(abi.encodeCall(PortLedger.port, (1, 2, bytes32(0), uint64(2000), empty)));
        blocked = !success && reason.length >= 4
            && bytes4(reason) == bytes4(keccak256("ReentrancyGuardReentrantCall()"));
    }
}

contract CoreContractsTest is TestBase {
    uint256 internal constant FEE = 0.001 ether;
    uint256 internal constant N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    uint64 internal constant DEADLINE = 2000;
    address internal constant OWNER = address(0x1111);
    address internal constant ORIGIN_ADMIN = address(0xA1);
    address internal constant SOCIAL_ADMIN = address(0xA2);
    address internal constant GALLERY_ADMIN = address(0xA3);
    address internal constant PAYOUT = address(0xB1);
    address internal constant FEE_RECIPIENT = address(0xB2);
    bytes32 internal constant SWORD = keccak256("rupa.weapon.sword");
    AppRegistry internal apps;
    RupaAsset internal asset;
    MappingRegistry internal mappings;
    PasskeyApprover internal approver;
    PortLedger internal ledger;
    IdentityMock internal identity;
    bytes32 internal socialMapping;

    function setUp() public {
        vm.warp(1000);
        vm.chainId(10143);
        vm.deal(address(this), 1 ether);
        apps = new AppRegistry();
        vm.prank(ORIGIN_ADMIN);
        apps.registerApp("Arena", "ipfs://arena", keccak256("arena"), PAYOUT, 500);
        vm.prank(SOCIAL_ADMIN);
        apps.registerApp("Social", "ipfs://social", keccak256("social"), SOCIAL_ADMIN, 0);
        vm.prank(GALLERY_ADMIN);
        apps.registerApp("Gallery", "ipfs://gallery", keccak256("gallery"), GALLERY_ADMIN, 0);
        asset = new RupaAsset(apps);
        identity = new IdentityMock(vm.addr(3));
        mappings = new MappingRegistry(apps, identity, address(this));
        approver = new PasskeyApprover(sha256("localhost"), "http://localhost:5173", address(this));
        ledger = new PortLedger(apps, asset, mappings, approver, FEE, FEE_RECIPIENT, address(this));
        mappings.bindLedger(address(ledger));
        approver.bindLedger(address(ledger));
        vm.etch(address(0x0100), address(new P256TestVerifier()).code);
        vm.prank(ORIGIN_ADMIN);
        asset.mint(OWNER, SWORD, 3, 1, keccak256("attributes"), "ipfs://asset");
        _register(OWNER, 1);
        socialMapping = _propose(SWORD, 2, 1, keccak256("social mapping"));
    }

    function _register(address owner_, uint256 scalar) internal {
        (uint256 x, uint256 y) = vm.publicKeyP256(scalar);
        vm.prank(owner_);
        approver.registerPasskey(x, y, keccak256(abi.encode(owner_)));
    }

    function _agentSignature(
        bytes32 assetType,
        uint32 app,
        uint64 version_,
        bytes32 contentHash,
        uint256 scalar
    ) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            scalar, mappings.proposalDigest(assetType, app, version_, 1, contentHash)
        );
        return abi.encodePacked(r, s, v);
    }

    function _propose(bytes32 assetType, uint32 app, uint64 version_, bytes32 contentHash)
        internal
        returns (bytes32)
    {
        return mappings.proposeMapping(
            assetType,
            app,
            version_,
            1,
            contentHash,
            "ipfs://mapping",
            _agentSignature(assetType, app, version_, contentHash, 3)
        );
    }

    function _assertion(uint32 app, bytes32 mappingId, uint256 scalar)
        internal
        view
        returns (WebAuthnLib.Assertion memory a)
    {
        a.authenticatorData = abi.encodePacked(sha256("localhost"), uint8(5), uint32(0));
        a.clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            Base64Url.encode(ledger.approvalHash(1, app, mappingId, DEADLINE)),
            '","origin":"http://localhost:5173","crossOrigin":false}'
        );
        a.typeIndex = 1;
        a.challengeIndex = 23;
        (bytes32 r, bytes32 s) = vm.signP256(
            scalar, sha256(abi.encodePacked(a.authenticatorData, sha256(bytes(a.clientDataJSON))))
        );
        a.r = uint256(r);
        a.s = uint256(s) > N / 2 ? N - uint256(s) : uint256(s);
    }

    function _portSocial() internal returns (bytes32) {
        return ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, _assertion(2, socialMapping, 1));
    }

    function testPortDoesNotMoveOwnershipAndActivatesCache() public {
        bytes32 id = _portSocial();
        require(asset.ownerOf(1) == OWNER);
        assertEq(ledger.headOf(1), id);
        assertEq(approver.nonces(OWNER), 1);
        assertEq(mappings.activeMapping(mappings.pairKey(SWORD, 2)), socialMapping);
        assertEq(mappings.mappings(socialMapping).approvals, 1);
        (bool active, bytes32 selected) = ledger.isActive(1, 2);
        require(active);
        assertEq(selected, socialMapping);
    }

    function testProvenanceRecordEncodingAndSequence() public {
        bytes32 first = _portSocial();
        PortLedger.PortRecord memory record =
            PortLedger.PortRecord(1, 1, 2, socialMapping, 1, OWNER, 1000, bytes32(0));
        assertEq(first, keccak256(abi.encode(record)));
        bytes32 gallery = _propose(SWORD, 3, 1, keccak256("gallery mapping"));
        vm.warp(1001);
        bytes32 second = ledger.port{value: FEE}(1, 3, gallery, DEADLINE, _assertion(3, gallery, 1));
        record = PortLedger.PortRecord(1, 2, 3, gallery, 1, OWNER, 1001, first);
        assertEq(second, keccak256(abi.encode(record)));
        assertEq(ledger.headOf(1), second);
        assertEq(ledger.activeIn(1, 2), socialMapping);
    }

    function testRoyaltyAndFeeAreActuallyTransferred() public {
        _portSocial();
        assertEq(PAYOUT.balance, FEE * 500 / 10_000);
        assertEq(FEE_RECIPIENT.balance, FEE - FEE * 500 / 10_000);
        assertEq(address(ledger).balance, 0);
    }

    function testIncorrectFeeRejectsWithoutConsumingNonce() public {
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        vm.expectRevert(PortLedger.InvalidFee.selector);
        ledger.port{value: FEE - 1}(1, 2, socialMapping, DEADLINE, a);
        vm.expectRevert(PortLedger.InvalidFee.selector);
        ledger.port{value: FEE + 1}(1, 2, socialMapping, DEADLINE, a);
        assertEq(approver.nonces(OWNER), 0);
    }

    function testOwnerChangeInvalidatesPendingApproval() public {
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        _register(address(0x2222), 2);
        vm.prank(OWNER);
        asset.transferFrom(OWNER, address(0x2222), 1);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, a);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, _assertion(2, socialMapping, 2));
        assertEq(approver.nonces(address(0x2222)), 1);
    }

    function testTransferPreservesHistoricalActivation() public {
        bytes32 head = _portSocial();
        vm.prank(OWNER);
        asset.transferFrom(OWNER, address(0x2222), 1);
        (bool active,) = ledger.isActive(1, 2);
        require(active);
        assertEq(ledger.headOf(1), head);
    }

    function testRevokedMappingCannotPortAndHistorySurvives() public {
        bytes32 head = _portSocial();
        vm.prank(SOCIAL_ADMIN);
        mappings.revokeMapping(socialMapping);
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        vm.expectRevert(PortLedger.InvalidMapping.selector);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, a);
        assertEq(ledger.headOf(1), head);
        assertEq(mappings.activeMapping(mappings.pairKey(SWORD, 2)), bytes32(0));
    }

    function testSchemaUpdateRejectsOldMappingAndNewApprovalReplacesStalePointer() public {
        _portSocial();
        vm.prank(SOCIAL_ADMIN);
        apps.updateSchema(2, "ipfs://social-v2", keccak256("social-v2"));
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        vm.expectRevert(PortLedger.InvalidMapping.selector);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, a);
        bytes32 current = _propose(SWORD, 2, 2, keccak256("mapping-v2"));
        ledger.port{value: FEE}(1, 2, current, DEADLINE, _assertion(2, current, 1));
        assertEq(mappings.activeMapping(mappings.pairKey(SWORD, 2)), current);
    }

    function testWrongTargetAndTypeRejected() public {
        WebAuthnLib.Assertion memory a = _assertion(3, socialMapping, 1);
        vm.expectRevert(PortLedger.InvalidMapping.selector);
        ledger.port{value: FEE}(1, 3, socialMapping, DEADLINE, a);
        bytes32 wrongType = _propose(keccak256("other"), 2, 1, keccak256("other mapping"));
        a = _assertion(2, wrongType, 1);
        vm.expectRevert(PortLedger.InvalidMapping.selector);
        ledger.port{value: FEE}(1, 2, wrongType, DEADLINE, a);
    }

    function testAgentSignatureAndDuplicateProposal() public {
        bytes32 hash = keccak256("new mapping");
        bytes memory bad = _agentSignature(SWORD, 2, 1, hash, 4);
        vm.expectRevert(MappingRegistry.InvalidAgentSignature.selector);
        mappings.proposeMapping(SWORD, 2, 1, 1, hash, "ipfs://mapping", bad);
        bytes memory duplicate = _agentSignature(SWORD, 2, 1, keccak256("social mapping"), 3);
        vm.expectRevert(MappingRegistry.DuplicateMapping.selector);
        mappings.proposeMapping(SWORD, 2, 1, 1, keccak256("social mapping"), "ipfs://mapping", duplicate);
    }

    function testZeroAgentWalletUsesCurrentOwner() public {
        identity.setWallet(address(0));
        _propose(SWORD, 3, 1, keccak256("fallback-owner"));
        identity.setWallet(vm.addr(4));
        bytes32 hash = keccak256("new-wallet");
        bytes memory oldSignature = _agentSignature(SWORD, 3, 1, hash, 3);
        vm.expectRevert(MappingRegistry.InvalidAgentSignature.selector);
        mappings.proposeMapping(SWORD, 3, 1, 1, hash, "ipfs://mapping", oldSignature);
    }

    function testOnlyTargetAdminAndLedgerCanMutateMappingState() public {
        vm.expectRevert(MappingRegistry.Unauthorized.selector);
        mappings.setActive(SWORD, 2, socialMapping);
        vm.expectRevert(MappingRegistry.Unauthorized.selector);
        mappings.revokeMapping(socialMapping);
        vm.expectRevert(MappingRegistry.Unauthorized.selector);
        mappings.noteApproval(socialMapping);
        vm.prank(SOCIAL_ADMIN);
        mappings.setActive(SWORD, 2, socialMapping);
        assertEq(mappings.activeMapping(mappings.pairKey(SWORD, 2)), socialMapping);
    }

    function testAppAndMintPermissions() public {
        vm.expectRevert(AppRegistry.Unauthorized.selector);
        apps.updateSchema(1, "ipfs://other", keccak256("other"));
        vm.expectRevert(AppRegistry.Unauthorized.selector);
        apps.setMinter(1, OWNER);
        vm.expectRevert(RupaAsset.Unauthorized.selector);
        asset.mint(OWNER, SWORD, 0, 1, keccak256("attrs"), "ipfs://asset");
        vm.expectRevert(RupaAsset.InvalidAsset.selector);
        vm.prank(ORIGIN_ADMIN);
        asset.mint(OWNER, SWORD, 5, 1, keccak256("attrs"), "ipfs://asset");
        vm.expectRevert(AppRegistry.InvalidApp.selector);
        apps.registerApp("invalid", "ipfs://schema", keccak256("schema"), PAYOUT, 501);
    }

    function testRecordUseRequiresRelatedAppAdmin() public {
        vm.expectRevert(PortLedger.Unauthorized.selector);
        ledger.recordUse(1, 1, keccak256("WIN"));
        vm.prank(ORIGIN_ADMIN);
        ledger.recordUse(1, 1, keccak256("WIN"));
        vm.expectRevert(PortLedger.NotActive.selector);
        vm.prank(SOCIAL_ADMIN);
        ledger.recordUse(1, 2, keccak256("VIEW"));
        _portSocial();
        vm.prank(SOCIAL_ADMIN);
        ledger.recordUse(1, 2, keccak256("VIEW"));
    }

    function testPauseBlocksPortsButAllowsReadAndKeyRecovery() public {
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        ledger.setPaused(true);
        vm.expectRevert(PortLedger.Paused.selector);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, a);
        ledger.isActive(1, 2);
        (uint256 x, uint256 y) = vm.publicKeyP256(2);
        vm.prank(OWNER);
        approver.rotatePasskey(x, y, keccak256("recovered"));
        ledger.setPaused(false);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, _assertion(2, socialMapping, 2));
    }

    function testPayoutFailureRollsBackAllPortState() public {
        _replaceLedger(address(new RejectPayment()));
        WebAuthnLib.Assertion memory a = _assertion(2, socialMapping, 1);
        vm.expectRevert(PortLedger.PaymentFailed.selector);
        ledger.port{value: FEE}(1, 2, socialMapping, DEADLINE, a);
        assertEq(approver.nonces(OWNER), 0);
        assertEq(ledger.headOf(1), bytes32(0));
        assertEq(mappings.mappings(socialMapping).approvals, 0);
        assertEq(PAYOUT.balance, 0);
    }

    function testPaymentCannotReenterPort() public {
        ReentrantRecipient recipient = new ReentrantRecipient();
        _replaceLedger(address(recipient));
        recipient.configure(ledger);
        _portSocial();
        require(recipient.blocked());
        assertEq(approver.nonces(OWNER), 1);
    }

    function _replaceLedger(address recipient) internal {
        // New immutable deployment for payment tests; never rebinding a live ledger.
        mappings = new MappingRegistry(apps, identity, address(this));
        approver = new PasskeyApprover(sha256("localhost"), "http://localhost:5173", address(this));
        ledger = new PortLedger(apps, asset, mappings, approver, FEE, recipient, address(this));
        mappings.bindLedger(address(ledger));
        approver.bindLedger(address(ledger));
        _register(OWNER, 1);
        socialMapping = _propose(SWORD, 2, 1, keccak256("social mapping"));
    }
}
