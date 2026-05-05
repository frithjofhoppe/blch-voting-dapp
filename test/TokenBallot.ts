import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("TokenBallot", function () {
  async function deployBallot() {
    const [deployer, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy VoteToken with voters
    const voteToken = await ethers.deployContract("VoteToken", [
      [voter1.address, voter2.address, voter3.address],
    ]);

    const durationInSeconds = 100;
    const ballotTitle = "Where to go?";
    const options = ["Bern", "Basel", "Zurich"];

    const ballot = await ethers.deployContract("TokenBallot", [
      await voteToken.getAddress(),
      ballotTitle,
      options,
      durationInSeconds,
    ]);

    return { ballot, voteToken, deployer, voter1, voter2, voter3 };
  }

  describe("Deployment", function () {
    it("Should initialize with correct parameters", async function () {
      const { ballot } = await deployBallot();

      expect(await ballot.title()).to.equal("Where to go?");
      expect(await ballot.getOptionCount()).to.equal(3);

      const option0 = await ballot.getOption(0);
      expect(option0[0]).to.equal("Bern");
      expect(option0[1]).to.equal(0);
    });

    it("Should reject ballot with less than 2 options", async function () {
      const [deployer] = await ethers.getSigners();

      const voteToken = await ethers.deployContract("VoteToken", [[deployer.address]]);

      await expect(
        ethers.deployContract("TokenBallot", [
          await voteToken.getAddress(),
          "Invalid Ballot",
          ["Only One"], // Less than 2 options
          100,
        ])
      ).to.be.revertedWith("At least two options required");
    });

    it("Should reject ballot with invalid token address", async function () {
      const [deployer] = await ethers.getSigners();

      await expect(
        ethers.deployContract("TokenBallot", [
          "0x0000000000000000000000000000000000000000",
          "Invalid Ballot",
          ["Option 1", "Option 2"],
          100,
        ])
      ).to.be.revertedWith("Invalid token address");
    });

    it("Should reject ballot with zero duration", async function () {
      const [deployer] = await ethers.getSigners();

      const voteToken = await ethers.deployContract("VoteToken", [[deployer.address]]);

      await expect(
        ethers.deployContract("TokenBallot", [
          await voteToken.getAddress(),
          "Invalid Ballot",
          ["Option 1", "Option 2"],
          0, // Zero duration
        ])
      ).to.be.revertedWith("Duration must be positive");
    });
  });

  describe("Voting", function () {
    it("Should allow voting before deadline", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // Voter1 approves and votes
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1);

      // Check vote was counted
      const option = await ballot.getOption(0);
      expect(option[1]).to.equal(1);
    });

    it("Should prevent voting after deadline", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // Get current deadline
      const deadline = await ballot.deadline();

      // Increase time to after deadline
      const timeToIncrease = Number(deadline) - (await ethers.provider.getBlock("latest"))?.timestamp! + 10;
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine", []);

      // Try to vote after deadline
      await voteToken.connect(voter1).approve(ballotAddress, 1);

      await expect(
        ballot.connect(voter1).vote(0, 1)
      ).to.be.revertedWith("Voting is closed");
    });

    it("Should prevent voting with invalid option", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      await voteToken.connect(voter1).approve(ballotAddress, 1);

      await expect(
        ballot.connect(voter1).vote(999, 1) // Invalid option index
      ).to.be.revertedWith("Invalid option");
    });

    it("Should prevent voting with zero amount", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      await voteToken.connect(voter1).approve(ballotAddress, 1);

      await expect(
        ballot.connect(voter1).vote(0, 0) // Zero amount
      ).to.be.revertedWith("Amount must be positive");
    });

    it("Should prevent double voting by same address", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // First vote
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1);

      // Try to vote again
      await voteToken.connect(voter1).approve(ballotAddress, 1);

      await expect(
        ballot.connect(voter1).vote(1, 1)
      ).to.be.revertedWith("Already voted");
    });

    it("Should track vote counts correctly", async function () {
      const { ballot, voteToken, voter1, voter2, voter3 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // voter1 votes for option 0
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1);

      // voter2 votes for option 1
      await voteToken.connect(voter2).approve(ballotAddress, 1);
      await ballot.connect(voter2).vote(1, 1);

      // voter3 votes for option 0
      await voteToken.connect(voter3).approve(ballotAddress, 1);
      await ballot.connect(voter3).vote(0, 1);

      // Check counts
      const option0 = await ballot.getOption(0);
      const option1 = await ballot.getOption(1);
      const option2 = await ballot.getOption(2);

      expect(option0[1]).to.equal(2);
      expect(option1[1]).to.equal(1);
      expect(option2[1]).to.equal(0);
    });

    it("Should emit VoteCast event", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      await voteToken.connect(voter1).approve(ballotAddress, 1);

      await expect(
        ballot.connect(voter1).vote(0, 1)
      ).to.emit(ballot, "VoteCast").withArgs(voter1.address, 0, 1);
    });
  });

  describe("Winner Determination", function () {
    it("Should reject getWinner() before deadline", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1);

      // Try to get winner while voting is open
      await expect(
        ballot.getWinner()
      ).to.be.revertedWith("Voting is still open");
    });

    it("Should determine winner after deadline", async function () {
      const { ballot, voteToken, voter1, voter2, voter3 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // Register votes
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1); // Bern gets 1

      await voteToken.connect(voter2).approve(ballotAddress, 1);
      await ballot.connect(voter2).vote(1, 1); // Basel gets 1

      await voteToken.connect(voter3).approve(ballotAddress, 1);
      await ballot.connect(voter3).vote(0, 1); // Bern gets 2nd vote

      // Get current deadline and increase time
      const deadline = await ballot.deadline();
      const currentTime = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
      const timeToIncrease = Number(deadline) - currentTime + 10;
      
      // Increase time to after deadline
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine", []);

      // Get winner
      const result = await ballot.getWinner();

      expect(result[0]).to.equal(0); // Index 0 (Bern)
      expect(result[1]).to.equal("Bern");
      expect(result[2]).to.equal(2); // 2 votes
    });

    it("Should handle tie scenario (returns first option)", async function () {
      const { ballot, voteToken, voter1, voter2 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // Create a tie
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1); // Option 0 gets 1

      await voteToken.connect(voter2).approve(ballotAddress, 1);
      await ballot.connect(voter2).vote(1, 1); // Option 1 gets 1

      // Get current deadline and increase time
      const deadline = await ballot.deadline();
      const currentTime = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
      const timeToIncrease = Number(deadline) - currentTime + 10;
      
      // Increase time to after deadline
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine", []);

      const result = await ballot.getWinner();

      // When there's a tie, first highest option wins
      expect(result[0]).to.equal(0); // Option 0 is first in tie
      expect(result[2]).to.equal(1); // 1 vote
    });

    it("Should handle no votes scenario", async function () {
      const { ballot } = await deployBallot();

      // Get current deadline and increase time
      const deadline = await ballot.deadline();
      const currentTime = (await ethers.provider.getBlock("latest"))?.timestamp || 0;
      const timeToIncrease = Number(deadline) - currentTime + 10;
      
      // Increase time to after deadline
      await ethers.provider.send("evm_increaseTime", [timeToIncrease]);
      await ethers.provider.send("evm_mine", []);

      const result = await ballot.getWinner();

      // With no votes, first option wins with 0 votes
      expect(result[0]).to.equal(0);
      expect(result[1]).to.equal("Bern");
      expect(result[2]).to.equal(0);
    });
  });

  describe("Ballot Status", function () {
    it("Should track hasVoted status correctly", async function () {
      const { ballot, voteToken, voter1 } = await deployBallot();

      const ballotAddress = await ballot.getAddress();

      // Initially not voted
      expect(await ballot.hasVoted(voter1.address)).to.be.false;

      // After voting
      await voteToken.connect(voter1).approve(ballotAddress, 1);
      await ballot.connect(voter1).vote(0, 1);

      expect(await ballot.hasVoted(voter1.address)).to.be.true;
    });

    it("Should return correct deadline", async function () {
      const { ballot } = await deployBallot();

      const deadline = await ballot.deadline();
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock?.timestamp || 0;

      // Deadline should be approximately current time + 100 seconds
      expect(Number(deadline)).to.be.closeTo(currentTime + 100, 5);
    });
  });
});
