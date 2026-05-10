import fs from "node:fs";
import path from "node:path";

const networkName = process.argv[2] ?? "localhost";
const rootDir = process.cwd();

const frontendBaseDir = fs.existsSync(path.join(rootDir, "frontend", "app"))
  ? path.join(rootDir, "frontend", "app")
  : path.join(rootDir, "frontend");

const frontendContractsDir = path.join(frontendBaseDir, "contracts");

fs.mkdirSync(frontendContractsDir, { recursive: true });

function copyAbi(contractFileName: string, contractName: string) {
  const artifactPath = path.join(
    rootDir,
    "artifacts",
    "contracts",
    contractFileName,
    `${contractName}.json`
  );

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const frontendArtifact = {
    contractName,
    abi: artifact.abi,
  };

  fs.writeFileSync(
    path.join(frontendContractsDir, `${contractName}.json`),
    JSON.stringify(frontendArtifact, null, 2)
  );
}

copyAbi("VoteToken.sol", "VoteToken");
copyAbi("PredictionMarket.sol", "PredictionMarket");

const deploymentPath = path.join(rootDir, "deployments", `${networkName}.json`);

if (!fs.existsSync(deploymentPath)) {
  throw new Error(
    `Missing deployment file ${deploymentPath}. Run deploy for ${networkName} before exporting frontend files.`
  );
}

const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

const frontendAddresses = {
  network: networkName,
  voteToken: deployment.voteToken,
  predictionMarket: deployment.predictionMarket,
  admin: deployment.admin,
};

const addressJson = JSON.stringify(frontendAddresses, null, 2);

// Keep the network-specific file for traceability/debugging.
fs.writeFileSync(
  path.join(frontendContractsDir, `addresses.${networkName}.json`),
  addressJson
);

// The frontend imports this stable file. CI/CD and Docker builds only need to
// decide which network is exported before building.
fs.writeFileSync(
  path.join(frontendContractsDir, "addresses.json"),
  addressJson
);

console.log(`Frontend contract files for ${networkName} written to ${frontendContractsDir}`);
