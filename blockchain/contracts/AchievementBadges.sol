// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AchievementBadges is ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;

    // Mapping from tokenId to badge type
    mapping(uint256 => string) private _tokenBadgeTypes;
    // Mapping from badge type to token URI
    mapping(string => string) private _badgeURIs;

    constructor() ERC721("AchievementBadges", "BADGE") Ownable(msg.sender) {
        _badgeURIs["Level Master"] = "data:application/json;base64,eyJuYW1lIjoiTGV2ZWwgTWFzdGVyIiwiZGVzY3JpcHRpb24iOiJBd2FyZGVkIGZvciBjb21wbGV0aW5nIGFsbCBsZXZlbHMhIiwiYXR0cmlidXRlcyI6W3sidHJhaXRfdHlwZSI6IkFjaGlldmVtZW50IiwidmFsdWUiOiJMZXZlbCBNYXN0ZXIifV19";
        _badgeURIs["Collectible Hunter"] = "data:application/json;base64,eyJuYW1lIjoiQ29sbGVjdGlibGUgSHVudGVyIiwiZGVzY3JpcHRpb24iOiJBd2FyZGVkIGZvciBjb2xsZWN0aW5nIGFsbCBzcGVjaWFsIGl0ZW1zISIsImF0dHJpYnV0ZXMiOlt7InRyYWl0X3R5cGUiOiJBY2hpZXZlbWVudCIsInZhbHVlIjoiQ29sbGVjdGlibGUgSHVudGVyIn1dfQ==";
        _badgeURIs["Streak Star"] = "data:application/json;base64,eyJuYW1lIjoiU3RyZWFrIFN0YXIiLCJkZXNjcmlwdGlvbiI6IkF3YXJkZWQgZm9yIGNvbXBsZXRpbmcgYSBsb25nIHN0cmVhayB3aXRob3V0IHJlc2V0ISIsImF0dHJpYnV0ZXMiOlt7InRyYWl0X3R5cGUiOiJBY2hpZXZlbWVudCIsInZhbHVlIjoiU3RyZWFrIFN0YXIifV19";
    }

    function mintBadge(address recipient, string memory badgeType) public {
        require(bytes(_badgeURIs[badgeType]).length > 0, "Invalid badge type");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _tokenBadgeTypes[tokenId] = badgeType;
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, _badgeURIs[badgeType]);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function addBadgeType(string memory badgeType, string memory badgeURI) public onlyOwner {
        _badgeURIs[badgeType] = badgeURI;
    }
}