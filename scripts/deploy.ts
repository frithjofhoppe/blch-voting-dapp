import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const { ethers, networkName } = await network.create();

const [deployer, voterA, voterB, voterC] = await ethers.getSigners();

console.log(`Deploying contracts to ${networkName}...`);
console.log(`Deployer: ${deployer.address}`);

const voteToken = await ethers.deployContract("VoteToken", [
  deployer.address,
]);

await voteToken.waitForDeployment();

const voteTokenAddress = await voteToken.getAddress();

console.log(`VoteToken deployed to: ${voteTokenAddress}`);

const ballotTitle = "Where should we go for the class event?";
const ballotOptions = ["Bern", "Basel", "Zuerich"];
const durationInSeconds = 120; // 7 days

const tokenBallot = await ethers.deployContract("TokenBallot", [
  voteTokenAddress,
  ballotTitle,
  ballotOptions,
  durationInSeconds,
]);

await tokenBallot.waitForDeployment();

const tokenBallotAddress = await tokenBallot.getAddress();

console.log(`TokenBallot deployed to: ${tokenBallotAddress}`);

const tokensPerVoter = 1;

console.log("Minting demo vote tokens...");

await (await voteToken.mint(voterA.address, tokensPerVoter)).wait();
await (await voteToken.mint(voterB.address, tokensPerVoter)).wait();
await (await voteToken.mint(voterC.address, tokensPerVoter)).wait();

console.log(`Minted ${tokensPerVoter} VOTE to voter A: ${voterA.address}`);
console.log(`Minted ${tokensPerVoter} VOTE to voter B: ${voterB.address}`);
console.log(`Minted ${tokensPerVoter} VOTE to voter C: ${voterC.address}`);

const deployment = {
  network: networkName,
  voteToken: voteTokenAddress,
  tokenBallot: tokenBallotAddress,
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