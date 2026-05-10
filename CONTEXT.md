# BLCH Prediction Market DApp

This repository is a simplified Polymarket-inspired prediction market demo.

One shared `VoteToken` is used as demo collateral. Users claim a fixed faucet amount once, create markets with a question, outcomes, deadline, and resolution context, then stake `VOTE` on the outcome they believe will happen. Market probabilities are derived from the token distribution across the outcome pools. After the deadline, the admin acts as a simplified oracle and resolves the market. Winners claim a proportional share of the locked pool.

This is intentionally not a full prediction-market protocol. There is no order book, AMM, ETH betting, dispute system, or decentralized oracle flow. The goal is a clean course-demo implementation that is easy to explain and use.
