import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("VoteToken", function () {
  async function deployVoteToken() {
    const [deployer, user] = await ethers.getSigners();

    const voteToken = await ethers.deployContract("VoteToken");

    return { voteToken, deployer, user };
  }

  it("mints 1000 VOTE on faucet claim", async function () {
    const { voteToken, user } = await deployVoteToken();

    await expect(voteToken.connect(user).claimFaucet())
      .to.emit(voteToken, "FaucetClaimed")
      .withArgs(user.address, ethers.parseEther("1000"));

    expect(await voteToken.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
  });

  it("allows claiming the faucet only once", async function () {
    const { voteToken, user } = await deployVoteToken();

    await voteToken.connect(user).claimFaucet();

    await expect(voteToken.connect(user).claimFaucet()).to.be.revertedWith("Already claimed");
  });

  it("uses 18 decimals", async function () {
    const { voteToken } = await deployVoteToken();

    expect(await voteToken.decimals()).to.equal(18n);
  });
});