// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./helpers/TestBase.sol";
import {ApprovalHash} from "../src/lib/ApprovalHash.sol";
import {Base64Url} from "../src/lib/Base64Url.sol";
import {PortLedger} from "../src/PortLedger.sol";

contract EncodingTest is TestBase {
    function testSharedTypeScriptApprovalVector() public view {
        string memory vector = vm.readFile("test/vectors/protocol.json");
        bytes32 mappingId = vm.parseJsonBytes32(vector, ".approval.mappingId");
        bytes32 computed = ApprovalHash.compute(
            10143,
            address(0x2222222222222222222222222222222222222222),
            address(0x1111111111111111111111111111111111111111),
            42,
            2,
            mappingId,
            0,
            2000
        );
        assertEq(computed, vm.parseJsonBytes32(vector, ".approvalHash"));
        assertEq(
            keccak256(bytes(Base64Url.encode(computed))),
            keccak256(bytes(vm.parseJsonString(vector, ".challenge")))
        );
    }

    function testSharedTypeScriptProvenanceVector() public view {
        string memory vector = vm.readFile("test/vectors/protocol.json");
        PortLedger.PortRecord memory record = PortLedger.PortRecord(
            42,
            1,
            2,
            vm.parseJsonBytes32(vector, ".record.mappingId"),
            7,
            address(0x1111111111111111111111111111111111111111),
            1000,
            bytes32(0)
        );
        assertEq(keccak256(abi.encode(record)), vm.parseJsonBytes32(vector, ".recordId"));
    }

    function testSharedMappingDslCanonicalHash() public view {
        string memory vector = vm.readFile("test/vectors/dsl-jcs.json");
        assertEq(
            keccak256(bytes(vm.parseJsonString(vector, ".canonical"))),
            vm.parseJsonBytes32(vector, ".contentHash")
        );
    }
}
