// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract VoteToken is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000 ether;

    mapping(address => bool) public hasClaimed;

    event FaucetClaimed(address indexed user, uint256 amount);

    constructor() ERC20("VoteToken", "VOTE") {}

    function claimFaucet() external {
        require(!hasClaimed[msg.sender], "Already claimed");

        hasClaimed[msg.sender] = true;
        _mint(msg.sender, FAUCET_AMOUNT);

        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }
}