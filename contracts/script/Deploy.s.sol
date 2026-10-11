// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AppRegistry} from "../src/AppRegistry.sol";
import {RupaAsset} from "../src/RupaAsset.sol";
import {MappingRegistry} from "../src/MappingRegistry.sol";
import {PasskeyApprover} from "../src/PasskeyApprover.sol";
import {PortLedger} from "../src/PortLedger.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";

interface DeployVm {
    function envAddress(string calldata name) external view returns (address);
    function envString(string calldata name) external view returns (string memory);
    function envUint(string calldata name) external view returns (uint256);
    function envOr(string calldata name, bool defaultValue) external view returns (bool);
    function startBroadcast(address sender) external;
    function stopBroadcast() external;
}

/// @notice Reproduction script. Existing Monad deployment must not be replaced.
/// @dev Supply a signer using Foundry's keystore/wallet options, never a key in this file.
contract Deploy {
    DeployVm private constant vm = DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Deployment {
        AppRegistry apps;
        RupaAsset asset;
        MappingRegistry mappings;
        PasskeyApprover approver;
        PortLedger ledger;
    }

    function run() external returns (Deployment memory d) {
        require(block.chainid == 31337 || block.chainid == 10143, "Unsupported chain");
        if (block.chainid == 10143) {
            require(vm.envOr("ALLOW_NEW_DEPLOYMENT", false), "Existing Monad deployment is protected");
        }
        address sender = vm.envAddress("DEPLOYER_ADDRESS");
        address identity = vm.envAddress("IDENTITY_REGISTRY");
        string memory rpId = vm.envString("RP_ID");
        string memory origin = vm.envString("ALLOWED_ORIGIN");
        uint256 fee = vm.envUint("PORT_FEE_WEI");
        address recipient = vm.envAddress("FEE_RECIPIENT");
        address pauseAdmin = vm.envAddress("PAUSE_ADMIN");
        require(bytes(rpId).length != 0 && identity.code.length != 0, "Invalid configuration");
        vm.startBroadcast(sender);
        d.apps = new AppRegistry();
        d.asset = new RupaAsset(d.apps);
        d.mappings = new MappingRegistry(d.apps, IIdentityRegistry(identity), sender);
        d.approver = new PasskeyApprover(sha256(bytes(rpId)), origin, sender);
        d.ledger = new PortLedger(d.apps, d.asset, d.mappings, d.approver, fee, recipient, pauseAdmin);
        d.mappings.bindLedger(address(d.ledger));
        d.approver.bindLedger(address(d.ledger));
        vm.stopBroadcast();
        require(d.mappings.ledger() == address(d.ledger), "Mapping wiring failed");
        require(d.approver.ledger() == address(d.ledger), "Passkey wiring failed");
    }
}
