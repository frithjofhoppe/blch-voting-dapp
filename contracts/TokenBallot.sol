// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TokenBallot {
    IERC20 public immutable voteToken;
    address public immutable creator;
    string public title;
    uint256 public deadline;

    string[] private optionNames;
    uint256[] private optionVotes;

    mapping(address => bool) public hasVoted;

    event VoteCast(address indexed voter, uint256 indexed optionIndex, uint256 amount);

    constructor(
        address voteTokenAddress,
        string memory ballotTitle,
        string[] memory options,
        uint256 durationInSeconds
    ) {
        require(voteTokenAddress != address(0), "Invalid token address");
        require(options.length >= 2, "At least two options required");
        require(durationInSeconds > 0, "Duration must be positive");

        voteToken = IERC20(voteTokenAddress);
        creator = msg.sender;
        title = ballotTitle;
        deadline = block.timestamp + durationInSeconds;

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Option name required");
            optionNames.push(options[i]);
            optionVotes.push(0);
        }
    }

    function vote(uint256 optionIndex, uint256 amount) external {
        require(block.timestamp < deadline, "Voting is closed");
        require(!hasVoted[msg.sender], "Already voted");
        require(optionIndex < optionNames.length, "Invalid option");
        require(amount > 0, "Amount must be positive");

        hasVoted[msg.sender] = true;
        optionVotes[optionIndex] += amount;

        bool success = voteToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");

        emit VoteCast(msg.sender, optionIndex, amount);
    }

    function getOptionCount() external view returns (uint256) {
        return optionNames.length;
    }

    function getOption(uint256 index) external view returns (string memory name, uint256 votes) {
        require(index < optionNames.length, "Invalid option");
        return (optionNames[index], optionVotes[index]);
    }

    function getWinner() external view returns (uint256 winningIndex, string memory winningName, uint256 winningVotes) {
        require(block.timestamp >= deadline, "Voting is still open");

        uint256 bestIndex = 0;
        uint256 bestVotes = optionVotes[0];

        for (uint256 i = 1; i < optionVotes.length; i++) {
            if (optionVotes[i] > bestVotes) {
                bestVotes = optionVotes[i];
                bestIndex = i;
            }
        }

        return (bestIndex, optionNames[bestIndex], bestVotes);
    }
}