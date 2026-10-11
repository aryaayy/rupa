// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PasskeyApprover} from "../src/PasskeyApprover.sol";
import {WebAuthnLib} from "../src/lib/WebAuthnLib.sol";
import {Base64Url} from "../src/lib/Base64Url.sol";
import {ApprovalHash} from "../src/lib/ApprovalHash.sol";
import {TestBase} from "./helpers/TestBase.sol";
import {P256TestVerifier} from "./helpers/P256TestVerifier.sol";

contract ApprovalLedgerHarness {
    PasskeyApprover public immutable approver;

    constructor(PasskeyApprover approver_) {
        approver = approver_;
    }

    function challenge(address owner, uint256 asset, uint32 target, bytes32 mappingId, uint64 deadline)
        public
        view
        returns (bytes32)
    {
        return ApprovalHash.compute(
            block.chainid, address(this), owner, asset, target, mappingId, approver.nonces(owner), deadline
        );
    }

    function approve(
        address owner,
        uint256 asset,
        uint32 target,
        bytes32 mappingId,
        uint64 deadline,
        WebAuthnLib.Assertion calldata assertion
    ) external returns (bool) {
        return approver.verifyApproval(
            owner, challenge(owner, asset, target, mappingId, deadline), deadline, assertion
        );
    }

    function approveThenRevert(address owner, uint64 deadline, WebAuthnLib.Assertion calldata assertion)
        external
    {
        approver.verifyApproval(
            owner, challenge(owner, 42, 2, bytes32(uint256(7)), deadline), deadline, assertion
        );
        revert("downstream failure");
    }
}

contract PasskeyApproverTest is TestBase {
    uint256 internal constant N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    address internal constant OWNER = address(0x1111);
    uint64 internal constant DEADLINE = 2000;
    bytes32 internal constant MAPPING = bytes32(uint256(7));
    PasskeyApprover internal approver;
    ApprovalLedgerHarness internal ledger;
    bytes32 internal rpHash;

    function setUp() public {
        vm.warp(1000);
        vm.chainId(10143);
        rpHash = sha256("localhost");
        approver = new PasskeyApprover(rpHash, "http://localhost:5173", address(this));
        ledger = new ApprovalLedgerHarness(approver);
        approver.bindLedger(address(ledger));
        vm.etch(address(0x0100), address(new P256TestVerifier()).code);
        (uint256 x, uint256 y) = vm.publicKeyP256(1); // Deliberately public test-only scalar.
        vm.prank(OWNER);
        approver.registerPasskey(x, y, keccak256("test-credential"));
    }

    function assertion(bytes32 challenge_, bytes32 rp, uint8 flags, string memory origin)
        internal
        pure
        returns (WebAuthnLib.Assertion memory a)
    {
        a.authenticatorData = abi.encodePacked(rp, flags, uint32(0));
        a.clientDataJSON = string.concat(
            '{"type":"webauthn.get","challenge":"',
            Base64Url.encode(challenge_),
            '","origin":"',
            origin,
            '","crossOrigin":false}'
        );
        a.typeIndex = 1;
        a.challengeIndex = 23;
        return sign(a, 1);
    }

    function sign(WebAuthnLib.Assertion memory a, uint256 scalar)
        internal
        pure
        returns (WebAuthnLib.Assertion memory)
    {
        bytes32 digest = sha256(abi.encodePacked(a.authenticatorData, sha256(bytes(a.clientDataJSON))));
        (bytes32 r, bytes32 s) = vm.signP256(scalar, digest);
        a.r = uint256(r);
        a.s = uint256(s) > N / 2 ? N - uint256(s) : uint256(s);
        return a;
    }

    function validAssertion() internal view returns (WebAuthnLib.Assertion memory) {
        return
            assertion(ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE), rpHash, 5, "http://localhost:5173");
    }

    function approve(WebAuthnLib.Assertion memory a) internal {
        require(ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE, a));
    }

    function reject(WebAuthnLib.Assertion memory a) internal {
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE, a);
        assertEq(approver.nonces(OWNER), 0);
    }

    function testValidSignatureUsesRealLocalP256Math() public {
        approve(validAssertion());
        assertEq(approver.nonces(OWNER), 1);
    }

    function testReplayRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        approve(a);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE, a);
        assertEq(approver.nonces(OWNER), 1);
    }

    function testDeadlineBoundaryAndExpiry() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.warp(DEADLINE);
        approve(a);
        vm.warp(DEADLINE + 1);
        vm.expectRevert(PasskeyApprover.DeadlineExpired.selector);
        ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE, a);
    }

    function testWrongRP() public {
        reject(
            assertion(
                ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE),
                sha256("evil.test"),
                5,
                "http://localhost:5173"
            )
        );
    }

    function testMissingUP() public {
        reject(
            assertion(ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE), rpHash, 4, "http://localhost:5173")
        );
    }

    function testMissingUV() public {
        reject(
            assertion(ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE), rpHash, 1, "http://localhost:5173")
        );
    }

    function testWrongOrigin() public {
        reject(assertion(ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE), rpHash, 5, "http://evil.test"));
    }

    function testWrongChallenge() public {
        reject(
            assertion(
                bytes32(uint256(ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE)) ^ 1),
                rpHash,
                5,
                "http://localhost:5173"
            )
        );
    }

    function testWrongChain() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.chainId(1);
        reject(a);
    }

    function testWrongAssetTargetMappingAndDeadline() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 43, 2, MAPPING, DEADLINE, a);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 3, MAPPING, DEADLINE, a);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 2, bytes32(uint256(8)), DEADLINE, a);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE + 1, a);
    }

    function testHighSRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        a.s = N - a.s;
        reject(a);
    }

    function testZeroAndOutOfRangeSignature() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        a.r = 0;
        reject(a);
        a.r = N;
        reject(a);
        a = validAssertion();
        a.s = 0;
        reject(a);
    }

    function testTruncatedAuthenticatorData() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        a.authenticatorData = new bytes(36);
        reject(sign(a, 1));
    }

    function testIndexOverflowRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        a.challengeIndex = type(uint256).max;
        reject(a);
        a = validAssertion();
        a.typeIndex = 0;
        reject(a);
    }

    function testChromiumExtraKeysAfterCrossOriginAccepted() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        bytes memory raw = bytes(a.clientDataJSON);
        bytes memory base = new bytes(raw.length - 1);
        for (uint256 i; i < base.length; ++i) {
            base[i] = raw[i];
        }
        a.clientDataJSON = string.concat(
            string(base),
            ',"other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}'
        );
        approve(sign(a, 1));
        assertEq(approver.nonces(OWNER), 1);
    }

    function testExtraKeysWithoutCrossOriginOrBadSuffixRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        bytes32 challenge_ = ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE);
        string memory head = string.concat(
            '{"type":"webauthn.get","challenge":"',
            Base64Url.encode(challenge_),
            '","origin":"http://localhost:5173"'
        );
        a.clientDataJSON = string.concat(head, ',"other_keys_can_be_added_here":"x"}');
        reject(sign(a, 1));
        a = validAssertion();
        a.clientDataJSON = string.concat(head, ',"crossOrigin":true,"extra":"x"}');
        reject(sign(a, 1));
        a = validAssertion();
        a.clientDataJSON = string.concat(head, ',"crossOrigin":false,"extra":"x"');
        reject(sign(a, 1));
        a = validAssertion();
        a.clientDataJSON = string.concat(head, ',"crossOrigin":false,}');
        reject(sign(a, 1));
    }

    function testWrongTypeAndDuplicateFieldsRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        a.clientDataJSON = '{"type":"webauthn.create","challenge":"wrong"}';
        reject(sign(a, 1));
        a = validAssertion();
        a.clientDataJSON = string.concat(a.clientDataJSON, ',"challenge":"duplicate"');
        reject(sign(a, 1));
    }

    function testMalformedPrecompileReturnsRejected() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.mockCall(address(0x0100), bytes(""), bytes(""));
        reject(a);
        vm.mockCall(address(0x0100), bytes(""), hex"01");
        reject(a);
        vm.mockCall(address(0x0100), bytes(""), abi.encode(uint256(0)));
        reject(a);
        vm.mockCall(address(0x0100), bytes(""), abi.encode(uint256(2)));
        reject(a);
        vm.mockCall(address(0x0100), bytes(""), abi.encode(uint256(1), uint256(1)));
        reject(a);
        vm.clearMockedCalls();
    }

    function testOnlyLedgerMayVerify() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.expectRevert(PasskeyApprover.Unauthorized.selector);
        approver.verifyApproval(OWNER, bytes32(0), DEADLINE, a);
    }

    function testBindingCannotBeChanged() public {
        vm.expectRevert(PasskeyApprover.LedgerAlreadyBound.selector);
        approver.bindLedger(address(ledger));
        PasskeyApprover other = new PasskeyApprover(rpHash, "http://localhost:5173", OWNER);
        vm.expectRevert(PasskeyApprover.Unauthorized.selector);
        other.bindLedger(address(ledger));
    }

    function testRegistrationCannotOverwriteOwnerKey() public {
        (uint256 x, uint256 y) = vm.publicKeyP256(2);
        vm.expectRevert(PasskeyApprover.AlreadyRegistered.selector);
        vm.prank(OWNER);
        approver.registerPasskey(x, y, keccak256("different"));
        vm.expectRevert(PasskeyApprover.InvalidKey.selector);
        approver.registerPasskey(0, 0, keccak256("invalid"));
        vm.expectRevert(PasskeyApprover.NoPasskey.selector);
        approver.rotatePasskey(x, y, keccak256("cannot-rotate-owner"));
    }

    function testRotationInvalidatesPendingApprovalEvenForSameKey() public {
        WebAuthnLib.Assertion memory old = validAssertion();
        (uint256 x, uint256 y) = vm.publicKeyP256(1);
        vm.prank(OWNER);
        approver.rotatePasskey(x, y, keccak256("rotated"));
        assertEq(approver.nonces(OWNER), 1);
        vm.expectRevert(PasskeyApprover.InvalidAssertion.selector);
        ledger.approve(OWNER, 42, 2, MAPPING, DEADLINE, old);
        approve(validAssertion());
        assertEq(approver.nonces(OWNER), 2);
    }

    function testDownstreamFailureRollsBackNonce() public {
        WebAuthnLib.Assertion memory a = validAssertion();
        vm.expectRevert();
        ledger.approveThenRevert(OWNER, DEADLINE, a);
        assertEq(approver.nonces(OWNER), 0);
    }

    function testFuzzWrongChallenge(bytes32 challenge_) public {
        bytes32 expected = ledger.challenge(OWNER, 42, 2, MAPPING, DEADLINE);
        if (challenge_ == expected) return;
        reject(assertion(challenge_, rpHash, 5, "http://localhost:5173"));
    }

    function testBase64Boundaries() public pure {
        require(
            keccak256(bytes(Base64Url.encode(bytes32(0))))
                == keccak256(bytes("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"))
        );
        require(
            keccak256(bytes(Base64Url.encode(bytes32(type(uint256).max))))
                == keccak256(bytes("__________________________________________8"))
        );
    }
}
