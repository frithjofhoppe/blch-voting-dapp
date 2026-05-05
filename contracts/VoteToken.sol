// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title VoteToken
 * @dev Simple ERC20 token for voting. Mints 1 token to each provided voter at deployment.
 * After deployment, tokens can only be transferred via the associated TokenBallot contract.
 */
contract VoteToken is ERC20 {
    address public immutable ballotAddress;

    /**
     * @dev Deploy VoteToken and mint 1 token to each voter
     * @param _voters Array of voter addresses to receive 1 token each
     */
    constructor(address[] memory _voters)
        ERC20("VoteToken", "VOTE")
    {
        ballotAddress = msg.sender; // The contract that deploys this token (BallotManager)
        for (uint256 i = 0; i < _voters.length; i++) {
            require(_voters[i] != address(0), "Invalid voter address");
            _mint(_voters[i], 1);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }
}