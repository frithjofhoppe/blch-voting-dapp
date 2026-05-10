# Prediction Market DApp Report

## 1. Introduction

### Project Goal

The goal of this project is to develop a decentralized prediction market application on Ethereum. Users can create markets for future events, stake a custom ERC20 token on possible outcomes, and claim rewards after the market has been resolved.

The application is inspired by prediction markets such as Polymarket, but it is intentionally simplified for educational purposes. Instead of using real money or stablecoins, the project uses a custom demo token called `VOTE`.

The main focus of the project is to demonstrate core DApp concepts:

- Smart contracts written in Solidity
- ERC20 token usage
- Wallet interaction through MetaMask
- Blockchain-based state management
- Token-based staking
- Market resolution through an oracle/admin
- Reward distribution through smart contracts

---

## 2. Use Case and Core Functionality

### Use Case

A user wants to create a prediction market for a future event.

Example:

```text
Will ETH be above 5000 USD on 01.07.2026?
```

Other users can then stake `VOTE` tokens on one of the possible outcomes, for example:

```text
YES
NO
```

After the market deadline has passed, an admin/oracle resolves the market by selecting the winning outcome. Users who staked on the winning outcome can then claim their proportional share of the total pool.

### Core Functionality

The core functionality of the application consists of the following steps:

1. A user connects their wallet through MetaMask.
2. The user claims demo tokens through the `VOTE` faucet.
3. The user creates a prediction market.
4. Other users stake `VOTE` tokens on possible outcomes.
5. The application displays the current pool distribution and implied probabilities.
6. After the deadline, the admin/oracle resolves the market.
7. Winning users claim their rewards.

### Example Workflow

```text
Alice claims 1000 VOTE.
Bob claims 1000 VOTE.
Charlie claims 1000 VOTE.

Alice creates the market:
"Will ETH be above 5000 USD on 01.07.2026?"

Possible outcomes:
- YES
- NO

Bob stakes 100 VOTE on YES.
Charlie stakes 50 VOTE on NO.

YES Pool = 100 VOTE
NO Pool = 50 VOTE
Total Pool = 150 VOTE

Displayed probability:
YES = 66.67%
NO = 33.33%

After the deadline, the admin resolves the market as YES.

Bob can now claim 150 VOTE.
Charlie receives no reward because he staked on the losing outcome.
```

---

## 3. Prediction Market Concept

### What Is a Prediction Market?

A prediction market is a market where participants can stake value on the outcome of future events. The distribution of stakes can be interpreted as a collective estimation of the probability of each outcome.

In real-world systems, prediction markets can use complex mechanisms such as order books, automated market makers, or decentralized oracle systems.

Our project implements a simplified pool-based prediction market.

### Our Simplified Model

In our model:

- Each market has a question.
- Each market has multiple possible outcomes.
- Users stake `VOTE` tokens on one outcome.
- Each outcome has its own pool.
- The probability of an outcome is calculated from the size of its pool compared to the total market pool.
- After resolution, the total pool is distributed proportionally among the users who staked on the winning outcome.

This means that the probability is not set by the admin. It emerges from user behavior.

### Pool-Based Probability

The implied probability is calculated as:

```text
outcomeProbability = outcomePool / totalPool
```

Example:

```text
YES Pool = 700 VOTE
NO Pool = 300 VOTE
Total Pool = 1000 VOTE

YES Probability = 700 / 1000 = 70%
NO Probability = 300 / 1000 = 30%
```

In the smart contract, probabilities are represented in basis points:

```text
10000 = 100.00%
7000  = 70.00%
3333  = 33.33%
```

---

## 4. Token Concept

### Why We Use a Custom ERC20 Token

The application uses a custom ERC20 token called `VOTE`.

The token is used as demo collateral for staking in prediction markets. It does not represent real money and has no real-world financial value.

The token is used for the following actions:

- Claiming demo funds through the faucet
- Staking on market outcomes
- Receiving rewards after winning a market

### Difference to the Previous Voting App

The original idea was closer to a token voting system, where tokens represent voting power.

The new prediction market model uses the token differently:

```text
Old voting system:
Token = voting right

New prediction market system:
Token = demo collateral / staking asset
```

In the new model, there is one shared token for the whole platform instead of one token per vote or per market.

### Why We Do Not Use Real ETH for Staking

The project does not use real ETH for staking because this would make the application more complex and risky.

Instead:

- Sepolia ETH is only used for gas fees.
- `VOTE` is used as the staking token.
- Users can claim `VOTE` from the faucet.
- No real money is required to use the application.

This makes the DApp safer and easier to demonstrate.

---

## 5. DApp Architecture

### Architecture Overview

```text
Browser Frontend
       |
       | ethers.js
       |
MetaMask / Wallet
       |
       | signed transactions
       |
Ethereum Blockchain
Localhost / Sepolia
       |
Smart Contracts
- VoteToken
- PredictionMarket
```

### Frontend

The frontend is responsible for user interaction.

It allows users to:

- Connect their wallet
- See their `VOTE` balance
- Claim `VOTE` tokens
- Create prediction markets
- View existing markets
- Stake on market outcomes
- View pool sizes and probabilities
- Resolve markets as admin/oracle
- Claim rewards after a market has been resolved

The frontend does not store the main application state itself. The important state is stored in the smart contracts.

### Wallet

MetaMask is used as the wallet provider.

Users sign transactions with their own wallet. The DApp never receives or stores private keys.

Wallets are used for:

- Identifying the user address
- Signing transactions
- Paying gas fees
- Sending contract interactions to the blockchain

### Smart Contracts

The application consists mainly of two smart contracts:

```text
VoteToken.sol
PredictionMarket.sol
```

#### VoteToken

The `VoteToken` contract provides the ERC20 token used in the application.

Responsibilities:

- Provide the `VOTE` token
- Allow users to claim demo tokens through a faucet
- Prevent users from claiming faucet tokens multiple times

#### PredictionMarket

The `PredictionMarket` contract contains the main application logic.

Responsibilities:

- Store all markets
- Store all outcomes
- Track user stakes
- Track outcome pools
- Calculate implied probabilities
- Allow market resolution
- Allow users to claim rewards

---

## 6. Smart Contract Design

### Market Data Structure

Each market contains the following information:

```solidity
struct Market {
    address creator;
    string question;
    string resolutionContext;
    uint256 deadline;
    bool resolved;
    uint256 winningOutcomeId;
    uint256 totalPool;
}
```

### Field Explanation

| Field | Meaning |
|---|---|
| `creator` | Address of the user who created the market |
| `question` | The prediction market question |
| `resolutionContext` | Explanation of how the market should be resolved |
| `deadline` | Time after which users can no longer stake |
| `resolved` | Shows whether the market has already been resolved |
| `winningOutcomeId` | The index of the winning outcome |
| `totalPool` | Total amount of `VOTE` staked in the market |

### Important Mappings

The contract uses mappings to store market data efficiently:

```solidity
mapping(uint256 => string[]) private marketOutcomes;
mapping(uint256 => mapping(uint256 => uint256)) public outcomePools;
mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userStakes;
mapping(uint256 => mapping(address => bool)) public claimed;
```

| Mapping | Purpose |
|---|---|
| `marketOutcomes` | Stores the outcome names for each market |
| `outcomePools` | Stores how many tokens are staked on each outcome |
| `userStakes` | Stores how much each user staked on each outcome |
| `claimed` | Tracks whether a user already claimed their reward |

---

## 7. Main Smart Contract Functions

### createMarket()

The `createMarket()` function allows any user to create a new prediction market.

Required input:

- Question
- Outcomes
- Duration
- Resolution context

Example:

```text
Question:
Will ETH be above 5000 USD on 01.07.2026?

Outcomes:
YES, NO

Resolution Context:
Resolve YES if the ETH/USD price on Coinbase is above 5000 USD at 12:00 UTC on 01.07.2026.
```

The resolution context is important because it defines how the admin/oracle should decide the result later.

### stake()

The `stake()` function allows users to stake `VOTE` tokens on an outcome.

Before staking, the user must approve the `PredictionMarket` contract to transfer their `VOTE` tokens.

Staking is only possible if:

- The market exists
- The market is not resolved
- The deadline has not passed
- The selected outcome exists
- The amount is greater than zero

### resolveMarket()

The `resolveMarket()` function is used by the admin/oracle to resolve a market.

A market can only be resolved if:

- The caller is the admin
- The market exists
- The deadline has passed
- The market has not already been resolved
- The selected winning outcome exists

This is a simplified oracle model. In a real-world prediction market, this role would likely be replaced by a decentralized oracle or dispute mechanism.

### claimReward()

The `claimReward()` function allows winning users to claim their rewards.

A user can only claim if:

- The market has been resolved
- The user has not already claimed
- The user staked on the winning outcome
- The winning pool is greater than zero

The reward is paid out by the smart contract using the `VOTE` tokens stored in the market pool.

---

## 8. Reward Logic

### Reward Formula

The reward is calculated as:

```text
reward = userWinningStake * totalPool / totalWinningPool
```

This means that users who staked on the winning outcome receive a proportional share of the entire market pool.

### Reward Example

```text
YES Pool = 250 VOTE
NO Pool = 50 VOTE
Total Pool = 300 VOTE

Alice stakes 100 VOTE on YES.
Bob stakes 150 VOTE on YES.
Charlie stakes 50 VOTE on NO.

YES wins.

Alice reward:
100 * 300 / 250 = 120 VOTE

Bob reward:
150 * 300 / 250 = 180 VOTE

Charlie reward:
0 VOTE
```

Interpretation:

```text
Alice and Bob receive their own stake back plus a proportional share of Charlie's losing stake.
```

---

## 9. User Workflow

### Normal User Workflow

```text
1. Open the DApp.
2. Connect MetaMask.
3. Make sure the correct network is selected.
4. Claim VOTE tokens through the faucet.
5. Create a market or select an existing market.
6. Approve the PredictionMarket contract to spend VOTE.
7. Stake VOTE on an outcome.
8. Wait until the market deadline has passed.
9. After the market is resolved, claim the reward if the user selected the winning outcome.
```

### Market Creator Workflow

```text
1. Connect wallet.
2. Claim VOTE if needed.
3. Create a new market.
4. Define a clear question.
5. Define at least two outcomes.
6. Define a deadline.
7. Define a resolution context.
8. Submit the transaction.
```

Example market:

```text
Question:
Will BTC be above 100000 USD on 01.08.2026?

Outcomes:
YES
NO

Resolution Context:
Resolve YES if the BTC/USD price on Coinbase is above 100000 USD at exactly 12:00 UTC on 01.08.2026. If Coinbase is unavailable, use Binance BTC/USDT as backup source.
```

### Admin / Oracle Workflow

```text
1. Connect with the admin/oracle wallet.
2. View markets whose deadline has passed.
3. Read the resolution context.
4. Check the real-world outcome.
5. Select the winning outcome.
6. Submit the resolve transaction.
7. Users can now claim rewards.
```

---

## 10. Deployment and Infrastructure Workflow

### Local Development Workflow

```bash
npm install
npm run compile
npm run test
npm run chain
npm run deploy:local
npm run export:frontend:local
npm run docker:build:local
docker run --rm -p 3000:3000 blch-voting-dapp:local
```

### Sepolia Deployment Workflow

```bash
SEPOLIA_RPC_URL="https://..." SEPOLIA_PRIVATE_KEY="0x..." npm run deploy:sepolia
npm run export:frontend:sepolia
npm run docker:build:sepolia
```

The private key is only required for deploying contracts and paying Sepolia gas fees.

It must never be committed to GitHub or included in the Docker image.

### Docker and GHCR Workflow

The Docker image contains only the frontend application and the exported smart contract configuration.

The image does not contain:

- Private keys
- Seed phrases
- Sepolia RPC secrets
- Deployment wallets
- Hardhat deployment logic

The intended workflow is:

```text
1. Deploy contracts manually.
2. Export frontend contract addresses and ABIs.
3. Build Docker image in GitHub Actions.
4. Publish image to GitHub Container Registry.
5. Azure later pulls the new image and updates the remote app.
```

This separates contract deployment from application deployment.

---

## 11. Security Considerations

### What Is Protected?

The smart contracts include several checks:

- A user can only stake before the deadline.
- A user can only stake on valid outcomes.
- A user can only stake a positive amount.
- A market can only be resolved once.
- A market can only be resolved after the deadline.
- Only the admin can resolve a market.
- Rewards can only be claimed once.
- Users can only claim rewards if they staked on the winning outcome.

### Pull-Based Reward Claiming

The reward system uses a pull-based model.

This means that the contract does not automatically send rewards to all winners during resolution. Instead, each winner calls `claimReward()` individually.

Advantages:

- Avoids expensive loops over all users
- Reduces gas cost during market resolution
- Scales better with more participants
- Gives users control over when to claim

### Central Oracle Limitation

The biggest simplification in our application is the central admin/oracle.

The admin decides the winning outcome after the deadline. This is simple and suitable for a course project, but it is not fully decentralized.

In a real-world prediction market, this should be replaced by:

- A decentralized oracle
- A multi-oracle system
- A dispute mechanism
- A governance-based resolution process

This limitation is important because the correctness of the market result depends on the honesty of the admin.

### Additional Limitations

Current limitations of the system:

- No decentralized oracle
- No dispute mechanism
- No market cancellation
- No protection against spam markets
- No creation fee or bond
- No automatic resolution
- No real-world price feed integration
- No advanced market maker or order book
- No trading of positions after staking

### Possible Improvements

Possible future improvements:

- Multiple oracle addresses instead of one admin
- Market cancellation for invalid markets
- Dispute mechanism for incorrect resolutions
- Market creation bond to reduce spam
- Integration with Chainlink or another oracle provider
- Better event history in the frontend
- Gas usage analysis
- More extensive automated tests
- Support for more complex market types
- Secondary trading of market positions

---

## 12. Code Quality and Implementation

### Code Structure

The project is structured into several parts:

```text
contracts/
- VoteToken.sol
- PredictionMarket.sol

scripts/
- deploy.ts
- export-frontend.ts

frontend/
- Nuxt frontend
- Wallet integration
- Contract integration
- Contract ABIs
- Address configuration

Docker/
- Dockerfile
- docker-entrypoint.sh
```

### Code Quality Measures

The project includes several quality-focused design decisions:

- Clear separation between token logic and market logic
- ERC20 token based on OpenZeppelin contracts
- Explicit validation in smart contract functions
- Events for important state changes
- No private keys in frontend or Docker image
- No central backend server for business logic
- Deployment addresses are exported instead of hardcoded
- Smart contract state is read directly from the blockchain

### Events

The `PredictionMarket` contract emits events for important actions:

```solidity
event MarketCreated(...);
event Staked(...);
event MarketResolved(...);
event RewardClaimed(...);
```

These events make it easier to track what happened on-chain and can later be used to build a better event history in the frontend.

---

## 13. Testing

The following aspects should be tested:

### VoteToken Tests

- A user can claim faucet tokens.
- A user cannot claim faucet tokens twice.
- The claimed balance is correct.

### PredictionMarket Tests

- A user can create a market.
- A market requires at least two outcomes.
- A user can stake after approving VOTE.
- Staking without approval fails.
- Staking after the deadline fails.
- Only the admin can resolve a market.
- A market cannot be resolved twice.
- A winning user can claim rewards.
- A losing user cannot claim rewards.
- A user cannot claim rewards twice.
- Probability calculation is correct.

---

## 14. Evaluation Based on Grading Criteria

### Umfang / Features

The core functionality is implemented:

- Token faucet
- Market creation
- Staking on outcomes
- Pool-based probability display
- Admin/oracle resolution
- Reward claiming
- Wallet-based frontend interaction

Additional convenience features:

- Overview of markets
- Display of pool sizes
- Display of implied probabilities
- Status display for markets
- Dockerized frontend
- GHCR image build pipeline

### Theorie / Conceptual Understanding

The project demonstrates several DApp core concepts:

- Ethereum smart contracts
- Solidity
- ERC20 token usage
- Wallet-based authentication
- MetaMask transaction signing
- Blockchain-based application state
- No central backend for business logic
- Pull-based reward claiming
- Separation between frontend and smart contract logic

The project also includes a critical reflection of the central oracle limitation.

The central admin/oracle is a conscious simplification for the course project. In a production system, it should be replaced by a decentralized oracle or dispute system.

### Praxis / Implementation and Code Quality

The implementation focuses on clear structure and understandable code.

Positive aspects:

- Separate contracts for token and market logic
- Clear function responsibilities
- Explicit require checks
- Events for important actions
- Deployment script
- Frontend export script
- Docker setup
- No private keys in the Docker image
- Configurable deployment addresses

### Report

The report should be logically structured and include:

- Project goal
- Use case
- Architecture
- Smart contract explanation
- User workflow
- Reward logic
- Security considerations
- Limitations
- Possible improvements
- Deployment workflow
- Reflection based on grading criteria

### Presentation

Suggested presentation structure:

1. Introduction and motivation
2. What is a prediction market?
3. Architecture overview
4. Smart contract design
5. User workflow
6. Live demo
7. Reward calculation
8. Security considerations
9. Limitations and future improvements
10. Conclusion

---

## 15. Suggested Team Work Distribution

### Person 1: Concept and Theory

Topics:

- What is a prediction market?
- Why a pool-based model?
- Why use an ERC20 token?
- Why use MetaMask?
- DApp architecture
- Comparison with real prediction markets

### Person 2: Smart Contracts

Topics:

- VoteToken contract
- PredictionMarket contract
- Market data structure
- Staking logic
- Resolution logic
- Reward calculation
- Security checks

### Person 3: Frontend and Deployment

Topics:

- Wallet connection
- User interface
- User workflow
- Admin/oracle workflow
- Localhost and Sepolia deployment
- Docker image
- GHCR pipeline
- Azure update concept

### Joint Section: Reflection

Topics:

- What works well?
- What was simplified?
- What are the main limitations?
- What are the biggest security risks?
- What would be improved in a production version?

---

## 16. Conclusion

The project implements a simplified but functional prediction market DApp. Users can claim a demo ERC20 token, create markets, stake on outcomes, and claim rewards after resolution.

The application demonstrates important DApp concepts such as Solidity smart contracts, wallet-based interaction, ERC20 approvals, blockchain-based state, and pull-based reward claiming.

The largest simplification is the central admin/oracle that resolves markets. This is acceptable for the educational scope of the project, but it would need to be replaced by a decentralized oracle or dispute mechanism in a production-ready application.

Overall, the project shows how a decentralized application can coordinate users, tokens, market state, and reward distribution without relying on a traditional centralized backend for the core business logic.
