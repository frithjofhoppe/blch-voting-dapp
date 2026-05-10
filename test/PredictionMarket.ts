import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("PredictionMarket", function () {
  async function deployMarketSystem() {
    const [admin, creator, traderA, traderB, outsider] = await ethers.getSigners();

    const voteToken = await ethers.deployContract("VoteToken");
    const predictionMarket = await ethers.deployContract("PredictionMarket", [
      await voteToken.getAddress(),
      admin.address,
    ]);

    return { voteToken, predictionMarket, admin, creator, traderA, traderB, outsider };
  }

  async function createYesNoMarket() {
    const system = await deployMarketSystem();
    const { predictionMarket, creator } = system;

    await predictionMarket.connect(creator).createMarket(
      "Will ETH be above 5000 USD on 01.07.2026 at 12:00 UTC?",
      ["YES", "NO"],
      120,
      "Resolve YES if ETH/USD on Coinbase is above 5000 USD at exactly 12:00 UTC. Use Binance ETH/USDT if Coinbase is unavailable."
    );

    return system;
  }

  it("allows users to create a market", async function () {
    const { predictionMarket, creator } = await deployMarketSystem();

    await expect(
      predictionMarket.connect(creator).createMarket(
        "Will it rain tomorrow?",
        ["YES", "NO"],
        60,
        "Resolve using the local weather station at noon."
      )
    ).to.emit(predictionMarket, "MarketCreated");

    expect(await predictionMarket.getMarketCount()).to.equal(1n);
  });

  it("rejects invalid market creation inputs", async function () {
    const { predictionMarket, creator } = await deployMarketSystem();

    await expect(
      predictionMarket.connect(creator).createMarket("", ["YES", "NO"], 60, "Context")
    ).to.be.revertedWith("Question required");

    await expect(
      predictionMarket.connect(creator).createMarket("Question", ["YES", "NO"], 60, "")
    ).to.be.revertedWith("Resolution context required");

    await expect(
      predictionMarket.connect(creator).createMarket("Question", ["YES"], 60, "Context")
    ).to.be.revertedWith("At least two outcomes required");
  });

  it("allows staking after approval and updates pools", async function () {
    const { voteToken, predictionMarket, traderA } = await createYesNoMarket();
    const marketAddress = await predictionMarket.getAddress();
    const stakeAmount = ethers.parseEther("25");

    await voteToken.connect(traderA).claimFaucet();
    await voteToken.connect(traderA).approve(marketAddress, stakeAmount);

    await expect(
      predictionMarket.connect(traderA).stake(0, 0, stakeAmount)
    ).to.emit(predictionMarket, "Staked");

    expect(await predictionMarket.outcomePools(0, 0)).to.equal(stakeAmount);
    expect(await predictionMarket.getUserStake(0, traderA.address, 0)).to.equal(stakeAmount);
  });

  it("rejects staking without approval", async function () {
    const { voteToken, predictionMarket, traderA } = await createYesNoMarket();
    const stakeAmount = ethers.parseEther("10");

    await voteToken.connect(traderA).claimFaucet();

    await expect(
      predictionMarket.connect(traderA).stake(0, 0, stakeAmount)
    ).to.be.revertedWithCustomError(voteToken, "ERC20InsufficientAllowance");
  });

  it("rejects staking after deadline", async function () {
    const { voteToken, predictionMarket, traderA } = await deployMarketSystem();
    const marketAddress = await predictionMarket.getAddress();

    await predictionMarket.connect(traderA).createMarket(
      "Short market",
      ["YES", "NO"],
      1,
      "Resolve with any visible outcome."
    );

    await voteToken.connect(traderA).claimFaucet();
    await voteToken.connect(traderA).approve(marketAddress, ethers.parseEther("1"));

    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      predictionMarket.connect(traderA).stake(0, 0, ethers.parseEther("1"))
    ).to.be.revertedWith("Market closed");
  });

  it("calculates probabilities from pool shares", async function () {
    const { voteToken, predictionMarket, traderA, traderB } = await createYesNoMarket();
    const marketAddress = await predictionMarket.getAddress();

    const yesStake = ethers.parseEther("7");
    const noStake = ethers.parseEther("3");

    await voteToken.connect(traderA).claimFaucet();
    await voteToken.connect(traderB).claimFaucet();

    await voteToken.connect(traderA).approve(marketAddress, yesStake);
    await voteToken.connect(traderB).approve(marketAddress, noStake);

    await predictionMarket.connect(traderA).stake(0, 0, yesStake);
    await predictionMarket.connect(traderB).stake(0, 1, noStake);

    expect(await predictionMarket.getOutcomeProbability(0, 0)).to.equal(7000n);
    expect(await predictionMarket.getOutcomeProbability(0, 1)).to.equal(3000n);
  });

  it("allows only admin to resolve and only after deadline", async function () {
    const { predictionMarket, admin, traderA, traderB } = await deployMarketSystem();

    await predictionMarket.connect(traderA).createMarket(
      "Will the event happen?",
      ["YES", "NO"],
      60,
      "Resolve from the official event announcement."
    );

    await expect(
      predictionMarket.connect(traderB).resolveMarket(0, 0)
    ).to.be.revertedWith("Only admin");

    await expect(
      predictionMarket.connect(admin).resolveMarket(0, 0)
    ).to.be.revertedWith("Market still open");

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []);

    await expect(
      predictionMarket.connect(admin).resolveMarket(0, 0)
    ).to.emit(predictionMarket, "MarketResolved");
  });

  it("allows the winning user to claim proportional rewards", async function () {
    const { voteToken, predictionMarket, admin, traderA, traderB } = await createYesNoMarket();
    const marketAddress = await predictionMarket.getAddress();

    const yesStake = ethers.parseEther("7");
    const noStake = ethers.parseEther("3");

    await voteToken.connect(traderA).claimFaucet();
    await voteToken.connect(traderB).claimFaucet();

    await voteToken.connect(traderA).approve(marketAddress, yesStake);
    await voteToken.connect(traderB).approve(marketAddress, noStake);

    await predictionMarket.connect(traderA).stake(0, 0, yesStake);
    await predictionMarket.connect(traderB).stake(0, 1, noStake);

    await ethers.provider.send("evm_increaseTime", [121]);
    await ethers.provider.send("evm_mine", []);

    await predictionMarket.connect(admin).resolveMarket(0, 0);

    const beforeBalance = await voteToken.balanceOf(traderA.address);

    await expect(predictionMarket.connect(traderA).claimReward(0))
      .to.emit(predictionMarket, "RewardClaimed")
      .withArgs(0, traderA.address, ethers.parseEther("10"));

    const afterBalance = await voteToken.balanceOf(traderA.address);

    expect(afterBalance - beforeBalance).to.equal(ethers.parseEther("10"));
  });

  it("rejects losers and double claims", async function () {
    const { voteToken, predictionMarket, admin, traderA, traderB } = await createYesNoMarket();
    const marketAddress = await predictionMarket.getAddress();

    const yesStake = ethers.parseEther("7");
    const noStake = ethers.parseEther("3");

    await voteToken.connect(traderA).claimFaucet();
    await voteToken.connect(traderB).claimFaucet();

    await voteToken.connect(traderA).approve(marketAddress, yesStake);
    await voteToken.connect(traderB).approve(marketAddress, noStake);

    await predictionMarket.connect(traderA).stake(0, 0, yesStake);
    await predictionMarket.connect(traderB).stake(0, 1, noStake);

    await ethers.provider.send("evm_increaseTime", [121]);
    await ethers.provider.send("evm_mine", []);

    await predictionMarket.connect(admin).resolveMarket(0, 0);

    await expect(predictionMarket.connect(traderB).claimReward(0)).to.be.revertedWith("No winning stake");

    await predictionMarket.connect(traderA).claimReward(0);

    await expect(predictionMarket.connect(traderA).claimReward(0)).to.be.revertedWith("Already claimed");
  });
});