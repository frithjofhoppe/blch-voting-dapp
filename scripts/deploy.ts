import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName } = await network.create();

const [deployer, voterA, voterB, voterC] = await ethers.getSigners();

console.log(`Deploying contracts to ${networkName}...`);
console.log(`Deployer: ${deployer.address}`);

// Deploy BallotManager with deployer as admin
const ballotManager = await ethers.deployContract("BallotManager", [
  deployer.address,
]);

await ballotManager.waitForDeployment();

const ballotManagerAddress = await ballotManager.getAddress();

console.log(`BallotManager deployed to: ${ballotManagerAddress}`);

// Create the first ballot via BallotManager
const ballotTitle = "Where should we go for the class event?";
const ballotOptions = ["Bern", "Basel", "Zuerich"];
const voters = [voterA.address, voterB.address, voterC.address];
const durationInSeconds = 120; // 2 minutes for demo

console.log("Creating first ballot with BallotManager...");

const createBallotTx = await ballotManager.createBallot(
  ballotTitle,
  ballotOptions,
  voters,
  durationInSeconds
);

await createBallotTx.wait();

// Get the active ballot address
const activeBallotAddress = await ballotManager.activeBallot();

console.log(`TokenBallot created at: ${activeBallotAddress}`);
console.log(`Voters registered: ${voters.join(", ")}`);

const deployment = {
  network: networkName,
  ballotManager: ballotManagerAddress,
  activeBallot: activeBallotAddress,
  demoAccounts: {
    deployer: deployer.address,
    voterA: voterA.address,
    voterB: voterB.address,
    voterC: voterC.address,
  },
};

const deploymentsDir = path.join(process.cwd(), "deployments");
fs.mkdirSync(deploymentsDir, { recursive: true });

const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

console.log(`Deployment info written to: ${deploymentFile}`);
console.log("Deployment complete.");