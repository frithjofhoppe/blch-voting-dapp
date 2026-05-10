import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName } = await network.create();

const [deployer, userA, userB, userC] = await ethers.getSigners();

console.log(`Deploying contracts to ${networkName}...`);
console.log(`Deployer: ${deployer.address}`);

const voteToken = await ethers.deployContract("VoteToken");

await voteToken.waitForDeployment();

const voteTokenAddress = await voteToken.getAddress();

console.log(`VoteToken deployed to: ${voteTokenAddress}`);

const predictionMarket = await ethers.deployContract("PredictionMarket", [
  voteTokenAddress,
  deployer.address,
]);

await predictionMarket.waitForDeployment();

const predictionMarketAddress = await predictionMarket.getAddress();

console.log(`PredictionMarket deployed to: ${predictionMarketAddress}`);

const deployment = {
  network: networkName,
  voteToken: voteTokenAddress,
  predictionMarket: predictionMarketAddress,
  admin: deployer.address,
  demoAccounts: {
    deployer: deployer.address,
    userA: userA.address,
    userB: userB.address,
    userC: userC.address,
  },
};

const deploymentsDir = path.join(process.cwd(), "deployments");
fs.mkdirSync(deploymentsDir, { recursive: true });

const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

console.log(`Deployment info written to: ${deploymentFile}`);
console.log("Deployment complete.");