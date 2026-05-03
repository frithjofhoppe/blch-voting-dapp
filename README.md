# BLCH Voting DApp

This repository contains a Hardhat local chain, deployment scripts, and a Nuxt frontend.

## Prerequisites

Install these first:

- Node.js and npm
- MetaMask: https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn?hl=de

In MetaMask, add this local network:

- Network name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency symbol: ETH

## Install dependencies

From the repository root:

```shell
npm install
cd frontend
npm install
cd ..
```

## Run the app

Open three terminals and run these commands in order:

### Shell 1

Start the local Hardhat chain:

```shell
npm run chain
```

### Shell 2

Deploy the contracts to the local chain, then export the frontend contract files:

```shell
npm run deploy:local
npm run export:frontend
```

### Shell 3

Start the frontend:

```shell
cd frontend
npm run dev
```

## Notes

- Keep Shell 1 running while deploying and using the frontend.
- If MetaMask does not show the local chain automatically, switch to the Hardhat Local network you added above.
