// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./TokenBallot.sol";
import "./VoteToken.sol";

/**
 * @title BallotManager
 * @dev Manages the lifecycle of multiple TokenBallot instances.
 * Only the admin can create new ballots. Each ballot gets its own VoteToken instance.
 */
contract BallotManager {
    address public immutable admin;
    address public activeBallot;
    address[] public ballotHistory;

    event BallotCreated(
        address indexed ballotAddress,
        string title,
        address[] voters,
        string[] options,
        uint256 deadline
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can create ballots");
        _;
    }

    /**
     * @dev Initialize the BallotManager with an admin address
     * @param _admin The address allowed to create new ballots
     */
    constructor(address _admin) {
        require(_admin != address(0), "Invalid admin address");
        admin = _admin;
    }

    /**
     * @dev Create a new ballot with a fresh VoteToken instance
     * @param _title The ballot title/question
     * @param _optionNames Array of voting option names
     * @param _voters Array of voter addresses eligible for this ballot
     * @param _durationInSeconds How long voting should remain open (in seconds)
     * @return ballotAddress The address of the newly created TokenBallot
     */
    function createBallot(
        string memory _title,
        string[] memory _optionNames,
        address[] memory _voters,
        uint256 _durationInSeconds
    ) external onlyAdmin returns (address) {
        require(_optionNames.length > 0, "Must have at least one option");
        require(_voters.length > 0, "Must have at least one voter");
        require(_durationInSeconds > 0, "Duration must be greater than 0");

        // Deploy a fresh VoteToken for this ballot with voter array
        VoteToken newToken = new VoteToken(_voters);
        address tokenAddress = address(newToken);

        // Deploy new TokenBallot with the fresh token
        TokenBallot newBallot = new TokenBallot(
            tokenAddress,
            _title,
            _optionNames,
            _durationInSeconds
        );
        address ballotAddress = address(newBallot);

        // Update state
        activeBallot = ballotAddress;
        ballotHistory.push(ballotAddress);

        // Emit event
        emit BallotCreated(
            ballotAddress,
            _title,
            _voters,
            _optionNames,
            block.timestamp + _durationInSeconds
        );

        return ballotAddress;
    }

    /**
     * @dev Get the total number of ballots created
     */
    function getBallotCount() external view returns (uint256) {
        return ballotHistory.length;
    }

    /**
     * @dev Get a ballot address by index in history
     */
    function getBallotByIndex(uint256 _index) external view returns (address) {
        require(_index < ballotHistory.length, "Index out of bounds");
        return ballotHistory[_index];
    }

    /**
     * @dev Get all ballot addresses in history
     */
    function getAllBallots() external view returns (address[] memory) {
        return ballotHistory;
    }

    /**
     * @dev Check if a ballot is expired
     */
    function isBallotExpired(address _ballotAddress) external view returns (bool) {
        require(_ballotAddress != address(0), "Invalid ballot address");
        TokenBallot ballot = TokenBallot(_ballotAddress);
        return block.timestamp >= ballot.deadline();
    }

    /**
     * @dev Get deadline of a ballot
     */
    function getBallotDeadline(address _ballotAddress)
        external
        view
        returns (uint256)
    {
        require(_ballotAddress != address(0), "Invalid ballot address");
        TokenBallot ballot = TokenBallot(_ballotAddress);
        return ballot.deadline();
    }
}
