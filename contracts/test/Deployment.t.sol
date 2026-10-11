// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "./helpers/TestBase.sol";
import {Deploy} from "../script/Deploy.s.sol";

interface EnvironmentVm {
    function setEnv(string calldata name, string calldata value) external;
    function toString(address value) external pure returns (string memory);
}

contract DeploymentIdentityFixture {}

contract DeploymentTest is TestBase {
    EnvironmentVm private constant env = EnvironmentVm(address(vm));

    function testRehearsalWiresBothBindingsAndPreservesConfiguration() public {
        vm.chainId(31337);
        address sender = address(0x1234);
        DeploymentIdentityFixture identity = new DeploymentIdentityFixture();
        env.setEnv("DEPLOYER_ADDRESS", env.toString(sender));
        env.setEnv("IDENTITY_REGISTRY", env.toString(address(identity)));
        env.setEnv("RP_ID", "localhost");
        env.setEnv("ALLOWED_ORIGIN", "http://localhost:5173");
        env.setEnv("PORT_FEE_WEI", "1000000000000000");
        env.setEnv("FEE_RECIPIENT", env.toString(sender));
        env.setEnv("PAUSE_ADMIN", env.toString(sender));
        Deploy.Deployment memory d = new Deploy().run();
        require(d.mappings.ledger() == address(d.ledger), "mapping binding");
        require(d.approver.ledger() == address(d.ledger), "passkey binding");
        require(d.ledger.owner() == sender, "pause owner");
        assertEq(d.ledger.PORT_FEE(), 0.001 ether);
        assertEq(d.approver.RP_ID_HASH(), sha256("localhost"));
        require(keccak256(bytes(d.approver.allowedOrigin())) == keccak256("http://localhost:5173"), "origin");
        vm.prank(sender);
        vm.expectRevert();
        d.mappings.bindLedger(address(d.ledger));
        vm.prank(sender);
        vm.expectRevert();
        d.approver.bindLedger(address(d.ledger));
    }

    function testExistingMonadDeploymentProtectedByDefault() public {
        vm.chainId(10143);
        env.setEnv("ALLOW_NEW_DEPLOYMENT", "false");
        Deploy script = new Deploy();
        vm.expectRevert();
        script.run();
    }

    function testUnsupportedChainRejected() public {
        vm.chainId(1);
        Deploy script = new Deploy();
        vm.expectRevert();
        script.run();
    }
}
