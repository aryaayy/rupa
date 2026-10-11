// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AppRegistry} from "./AppRegistry.sol";

/// @notice Native canonical assets. External NFT wrapping is outside this implementation slice.
contract RupaAsset is ERC721 {
    struct Base {
        bytes32 assetType;
        uint8 rarity;
        uint32 originAppId;
        uint64 createdAt;
        bytes32 attrsHash;
    }
    error Unauthorized();
    error InvalidAsset();

    AppRegistry public immutable appRegistry;
    uint256 public totalMinted;
    mapping(uint256 id => Base base) public baseOf;
    mapping(uint256 id => string uri) private _uris;

    event AssetMinted(uint256 indexed id, bytes32 indexed assetType, uint32 indexed originAppId, address to);

    constructor(AppRegistry apps) ERC721("Rupa Asset", "RUPA") {
        if (address(apps) == address(0)) revert InvalidAsset();
        appRegistry = apps;
    }

    function mint(
        address to,
        bytes32 assetType,
        uint8 rarity,
        uint32 originAppId,
        bytes32 attrsHash,
        string calldata uri
    ) external returns (uint256 id) {
        if (msg.sender != appRegistry.minter(originAppId)) revert Unauthorized();
        if (
            rarity > 4 || assetType == bytes32(0) || attrsHash == bytes32(0) || bytes(uri).length == 0
                || bytes(uri).length > 2048
        ) revert InvalidAsset();
        id = ++totalMinted;
        baseOf[id] = Base(assetType, rarity, originAppId, uint64(block.timestamp), attrsHash);
        _uris[id] = uri;
        _safeMint(to, id);
        emit AssetMinted(id, assetType, originAppId, to);
    }

    function ownerOfAsset(uint256 id) external view returns (address) {
        return ownerOf(id);
    }

    function getBase(uint256 id) external view returns (Base memory) {
        _requireOwned(id);
        return baseOf[id];
    }

    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return _uris[id];
    }
}
