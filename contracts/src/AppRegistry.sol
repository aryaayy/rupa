// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AppRegistry {
    struct App {
        address admin;
        address minter;
        address payout;
        bytes32 schemaHash;
        string schemaURI;
        uint16 royaltyBps;
        uint64 version;
    }

    error Unauthorized();
    error UnknownApp();
    error InvalidApp();

    uint32 public appCount;
    mapping(uint32 appId => App app) private _apps;

    event AppRegistered(
        uint32 indexed appId, address indexed admin, string name, string schemaURI, bytes32 schemaHash
    );
    event SchemaUpdated(uint32 indexed appId, uint64 version, bytes32 schemaHash);
    event MinterUpdated(uint32 indexed appId, address indexed minter);

    function registerApp(
        string calldata name,
        string calldata schemaURI,
        bytes32 schemaHash,
        address payout,
        uint16 royaltyBps
    ) external returns (uint32 appId) {
        if (bytes(name).length == 0 || bytes(name).length > 128 || payout == address(0) || royaltyBps > 500) revert InvalidApp();
        _validateSchema(schemaURI, schemaHash);
        appId = ++appCount;
        _apps[appId] = App(msg.sender, msg.sender, payout, schemaHash, schemaURI, royaltyBps, 1);
        emit AppRegistered(appId, msg.sender, name, schemaURI, schemaHash);
    }

    function updateSchema(uint32 appId, string calldata schemaURI, bytes32 schemaHash) external {
        App storage app = _app(appId);
        if (msg.sender != app.admin) revert Unauthorized();
        _validateSchema(schemaURI, schemaHash);
        app.schemaHash = schemaHash;
        app.schemaURI = schemaURI;
        ++app.version;
        emit SchemaUpdated(appId, app.version, schemaHash);
    }

    function setMinter(uint32 appId, address newMinter) external {
        App storage app = _app(appId);
        if (msg.sender != app.admin) revert Unauthorized();
        if (newMinter == address(0)) revert InvalidApp();
        app.minter = newMinter;
        emit MinterUpdated(appId, newMinter);
    }

    function getApp(uint32 appId) external view returns (App memory) {
        return _app(appId);
    }

    function minter(uint32 appId) external view returns (address) {
        return _app(appId).minter;
    }

    function version(uint32 appId) external view returns (uint64) {
        return _app(appId).version;
    }

    function admin(uint32 appId) external view returns (address) {
        return _app(appId).admin;
    }

    function _app(uint32 appId) private view returns (App storage app) {
        app = _apps[appId];
        if (app.admin == address(0)) revert UnknownApp();
    }

    function _validateSchema(string calldata uri, bytes32 hash) private pure {
        if (bytes(uri).length == 0 || bytes(uri).length > 2048 || hash == bytes32(0)) revert InvalidApp();
    }
}
