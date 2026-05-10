// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PredictionMarket {
    IERC20 public immutable voteToken;
    address public immutable admin;

    struct Market {
        address creator;
        string question;
        string resolutionContext;
        uint256 deadline;
        bool resolved;
        uint256 winningOutcomeId;
        uint256 totalPool;
    }

    Market[] private markets;

    mapping(uint256 => string[]) private marketOutcomes;
    mapping(uint256 => mapping(uint256 => uint256)) public outcomePools;
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userStakes;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        string question,
        uint256 deadline
    );

    event Staked(
        uint256 indexed marketId,
        address indexed user,
        uint256 indexed outcomeId,
        uint256 amount
    );

    event MarketResolved(
        uint256 indexed marketId,
        uint256 indexed winningOutcomeId
    );

    event RewardClaimed(
        uint256 indexed marketId,
        address indexed user,
        uint256 amount
    );

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor(address voteTokenAddress, address adminAddress) {
        require(voteTokenAddress != address(0), "Invalid token address");
        require(adminAddress != address(0), "Invalid admin address");

        voteToken = IERC20(voteTokenAddress);
        admin = adminAddress;
    }

    function createMarket(
        string memory question,
        string[] memory outcomes,
        uint256 durationInSeconds,
        string memory resolutionContext
    ) external returns (uint256 marketId) {
        require(bytes(question).length > 0, "Question required");
        require(bytes(resolutionContext).length > 0, "Resolution context required");
        require(outcomes.length >= 2, "At least two outcomes required");
        require(durationInSeconds > 0, "Duration must be positive");

        marketId = markets.length;
        uint256 deadline = block.timestamp + durationInSeconds;

        markets.push(Market({
            creator: msg.sender,
            question: question,
            resolutionContext: resolutionContext,
            deadline: deadline,
            resolved: false,
            winningOutcomeId: 0,
            totalPool: 0
        }));

        for (uint256 i = 0; i < outcomes.length; i++) {
            require(bytes(outcomes[i]).length > 0, "Outcome required");
            marketOutcomes[marketId].push(outcomes[i]);
        }

        emit MarketCreated(marketId, msg.sender, question, deadline);
    }

    function stake(
        uint256 marketId,
        uint256 outcomeId,
        uint256 amount
    ) external {
        require(marketId < markets.length, "Invalid market");
        Market storage market = markets[marketId];

        require(!market.resolved, "Market already resolved");
        require(block.timestamp < market.deadline, "Market closed");
        require(outcomeId < marketOutcomes[marketId].length, "Invalid outcome");
        require(amount > 0, "Amount must be positive");

        bool success = voteToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Token transfer failed");

        userStakes[marketId][msg.sender][outcomeId] += amount;
        outcomePools[marketId][outcomeId] += amount;
        market.totalPool += amount;

        emit Staked(marketId, msg.sender, outcomeId, amount);
    }

    function resolveMarket(
        uint256 marketId,
        uint256 winningOutcomeId
    ) external onlyAdmin {
        require(marketId < markets.length, "Invalid market");
        Market storage market = markets[marketId];

        require(block.timestamp >= market.deadline, "Market still open");
        require(!market.resolved, "Market already resolved");
        require(winningOutcomeId < marketOutcomes[marketId].length, "Invalid outcome");

        market.resolved = true;
        market.winningOutcomeId = winningOutcomeId;

        emit MarketResolved(marketId, winningOutcomeId);
    }

    function claimReward(uint256 marketId) external {
        require(marketId < markets.length, "Invalid market");
        Market storage market = markets[marketId];

        require(market.resolved, "Market not resolved");
        require(!claimed[marketId][msg.sender], "Already claimed");

        uint256 winningOutcomeId = market.winningOutcomeId;
        uint256 userWinningStake = userStakes[marketId][msg.sender][winningOutcomeId];

        require(userWinningStake > 0, "No winning stake");

        uint256 totalWinningPool = outcomePools[marketId][winningOutcomeId];
        require(totalWinningPool > 0, "No winning pool");

        uint256 reward = (userWinningStake * market.totalPool) / totalWinningPool;
        require(reward > 0, "No reward");

        claimed[marketId][msg.sender] = true;

        bool success = voteToken.transfer(msg.sender, reward);
        require(success, "Reward transfer failed");

        emit RewardClaimed(marketId, msg.sender, reward);
    }

    function getMarketCount() external view returns (uint256) {
        return markets.length;
    }

    function getMarket(uint256 marketId)
        external
        view
        returns (
            address creator,
            string memory question,
            string memory resolutionContext,
            uint256 deadline,
            bool resolved,
            uint256 winningOutcomeId,
            uint256 totalPool
        )
    {
        require(marketId < markets.length, "Invalid market");
        Market storage market = markets[marketId];

        return (
            market.creator,
            market.question,
            market.resolutionContext,
            market.deadline,
            market.resolved,
            market.winningOutcomeId,
            market.totalPool
        );
    }

    function getOutcomeCount(uint256 marketId) external view returns (uint256) {
        require(marketId < markets.length, "Invalid market");
        return marketOutcomes[marketId].length;
    }

    function getOutcome(uint256 marketId, uint256 outcomeId)
        external
        view
        returns (
            string memory name,
            uint256 pool,
            uint256 probabilityBps
        )
    {
        require(marketId < markets.length, "Invalid market");
        require(outcomeId < marketOutcomes[marketId].length, "Invalid outcome");

        return (
            marketOutcomes[marketId][outcomeId],
            outcomePools[marketId][outcomeId],
            getOutcomeProbability(marketId, outcomeId)
        );
    }

    function getOutcomeProbability(
        uint256 marketId,
        uint256 outcomeId
    ) public view returns (uint256) {
        require(marketId < markets.length, "Invalid market");
        require(outcomeId < marketOutcomes[marketId].length, "Invalid outcome");

        uint256 totalPool = markets[marketId].totalPool;
        if (totalPool == 0) {
            return 0;
        }

        return (outcomePools[marketId][outcomeId] * 10_000) / totalPool;
    }

    function getUserStake(
        uint256 marketId,
        address user,
        uint256 outcomeId
    ) external view returns (uint256) {
        require(marketId < markets.length, "Invalid market");
        require(outcomeId < marketOutcomes[marketId].length, "Invalid outcome");

        return userStakes[marketId][user][outcomeId];
    }
}