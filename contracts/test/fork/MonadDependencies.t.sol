// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestBase} from "../helpers/TestBase.sol";

/// @dev Forked registry state checks. Direct native precompile checks live in scripts/verify-monad.mjs.
contract MonadDependenciesForkTest is TestBase {
    function setUp() public {
        vm.createSelectFork(vm.envString("MONAD_RPC_URL"));
        require(block.chainid == 10143, "expected Monad testnet");
    }

    function testExpectedRegistriesHaveCode() public view {
        require(address(0x8004A818BFB912233c491871b3d84c89A494BD9e).code.length != 0, "identity missing");
        require(address(0x8004B663056A597Dffe9eCcC1965A193B7388713).code.length != 0, "reputation missing");
    }

    function testReputationRegistryReferencesExpectedIdentity() public view {
        (bool success, bytes memory result) = address(0x8004B663056A597Dffe9eCcC1965A193B7388713)
            .staticcall(abi.encodeWithSignature("getIdentityRegistry()"));
        require(success && result.length == 32, "identity getter ABI mismatch");
        require(
            abi.decode(result, (address)) == address(0x8004A818BFB912233c491871b3d84c89A494BD9e),
            "identity binding mismatch"
        );
    }
}
