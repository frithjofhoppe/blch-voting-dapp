import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("BallotManager", function () {
  async function deployBallotManager() {
    const [admin, voter1, voter2, voter3, voter4, otherAddress] =
      await ethers.getSigners();

    const manager = await ethers.deployContract("BallotManager", [
      admin.address,
    ]);

    return { manager, admin, voter1, voter2, voter3, voter4, otherAddress };
  }

  describe("Deployment", function () {
    it("Should set the correct admin", async function () {
      const { manager, admin } = await deployBallotManager();
      expect(await manager.admin()).to.equal(admin.address);
    });

    it("Should have no ballots initially", async function () {
      const { manager } = await deployBallotManager();
      expect(await manager.getBallotCount()).to.equal(0);
      expect(await manager.activeBallot()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });
  });

  describe("Ballot Creation", function () {
    it("Should allow admin to create a ballot", async function () {
      const { manager, admin, voter1, voter2, voter3 } =
        await deployBallotManager();

      const title = "Test Ballot";
      const options = ["Option 1", "Option 2", "Option 3"];
      const voters = [voter1.address, voter2.address, voter3.address];
      const duration = 100;

      const tx = await manager.createBallot(title, options, voters, duration);

      // Check that ballot was created
      expect(await manager.getBallotCount()).to.equal(1);
      const activeBallot = await manager.activeBallot();
      expect(activeBallot).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      );

      // Check event emission
      await expect(tx).to.emit(manager, "BallotCreated");
    });

    it("Should prevent non-admin from creating a ballot", async function () {
      const { manager, voter1, voter2, voter3, otherAddress } =
        await deployBallotManager();

      const title = "Test Ballot";
      const options = ["Option 1", "Option 2"];
      const voters = [voter1.address, voter2.address, voter3.address];
      const duration = 100;

      const managerAsOther = manager.connect(otherAddress);

      await expect(
        managerAsOther.createBallot(title, options, voters, duration)
      ).to.be.revertedWith("Only admin can create ballots");
    });

    it("Should reject ballot with no options", async function () {
      const { manager, voter1, voter2 } = await deployBallotManager();

      const title = "Invalid Ballot";
      const options: string[] = [];
      const voters = [voter1.address, voter2.address];
      const duration = 100;

      await expect(
        manager.createBallot(title, options, voters, duration)
      ).to.be.revertedWith("Must have at least one option");
    });

    it("Should reject ballot with no voters", async function () {
      const { manager } = await deployBallotManager();

      const title = "Invalid Ballot";
      const options = ["Option 1", "Option 2"];
      const voters: string[] = [];
      const duration = 100;

      await expect(
        manager.createBallot(title, options, voters, duration)
      ).to.be.revertedWith("Must have at least one voter");
    });

    it("Should reject ballot with zero duration", async function () {
      const { manager, voter1, voter2 } = await deployBallotManager();

      const title = "Invalid Ballot";
      const options = ["Option 1", "Option 2"];
      const voters = [voter1.address, voter2.address];
      const duration = 0;

      await expect(
        manager.createBallot(title, options, voters, duration)
      ).to.be.revertedWith("Duration must be greater than 0");
    });
  });

  describe("Ballot History", function () {
    it("Should track multiple ballots", async function () {
      const { manager, admin, voter1, voter2, voter3, voter4 } =
        await deployBallotManager();

      // Create first ballot
      await manager.createBallot(
        "Ballot 1",
        ["Yes", "No"],
        [voter1.address, voter2.address],
        100
      );

      // Create second ballot
      await manager.createBallot(
        "Ballot 2",
        ["Option A", "Option B", "Option C"],
        [voter3.address, voter4.address],
        200
      );

      expect(await manager.getBallotCount()).to.equal(2);
      const allBallots = await manager.getAllBallots();
      expect(allBallots.length).to.equal(2);
    });

    it("Should update active ballot on creation", async function () {
      const { manager, voter1, voter2, voter3 } = await deployBallotManager();

      const tx1 = await manager.createBallot(
        "Ballot 1",
        ["Option 1", "Option 2"],
        [voter1.address],
        100
      );

      const receipt1 = await tx1.wait();
      const ballots1 = await manager.getAllBallots();
      const ballot1Address = ballots1[0];

      const activeBallot1 = await manager.activeBallot();
      expect(activeBallot1).to.equal(ballot1Address);

      const tx2 = await manager.createBallot(
        "Ballot 2",
        ["Option A", "Option B"],
        [voter2.address, voter3.address],
        200
      );

      const receipt2 = await tx2.wait();
      const ballots2 = await manager.getAllBallots();
      const ballot2Address = ballots2[1];

      const activeBallot2 = await manager.activeBallot();
      expect(activeBallot2).to.equal(ballot2Address);
    });

    it("Should retrieve ballot by index", async function () {
      const { manager, voter1, voter2, voter3 } = await deployBallotManager();

      const tx1 = await manager.createBallot(
        "Ballot 1",
        ["Yes", "No"],
        [voter1.address],
        100
      );

      const allBallots = await manager.getAllBallots();
      const ballot1Address = allBallots[0];

      const retrievedBallot = await manager.getBallotByIndex(0);
      expect(retrievedBallot).to.equal(ballot1Address);
    });
  });

  describe("Ballot Expiry Checking", function () {
    it("Should report ballot as not expired before deadline", async function () {
      const { manager, voter1, voter2 } = await deployBallotManager();

      const tx = await manager.createBallot(
        "Test Ballot",
        ["Option 1", "Option 2"],
        [voter1.address, voter2.address],
        1000 // 1000 seconds in future
      );

      const ballot = await manager.activeBallot();
      const isExpired = await manager.isBallotExpired(ballot);
      expect(isExpired).to.be.false;
    });

    it("Should report ballot as expired after deadline", async function () {
      const { manager, voter1, voter2 } = await deployBallotManager();

      const tx = await manager.createBallot(
        "Test Ballot",
        ["Option 1", "Option 2"],
        [voter1.address, voter2.address],
        1 // 1 second (will expire almost immediately)
      );

      const ballot = await manager.activeBallot();

      // Wait for deadline to pass
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mine a block to advance time
      await ethers.provider.send("evm_mine", []);

      const isExpired = await manager.isBallotExpired(ballot);
      expect(isExpired).to.be.true;
    });

    it("Should retrieve ballot deadline correctly", async function () {
      const { manager, voter1, voter2 } = await deployBallotManager();

      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock?.timestamp || 0;
      const durationInSeconds = 500;

      await manager.createBallot(
        "Test Ballot",
        ["Option 1", "Option 2"],
        [voter1.address, voter2.address],
        durationInSeconds
      );

      const ballot = await manager.activeBallot();
      const deadline = await manager.getBallotDeadline(ballot);

      // Deadline should be approximately current time + duration
      // Allow a small margin for execution time
      expect(Number(deadline)).to.be.closeTo(
        currentTime + durationInSeconds,
        5
      );
    });
  });

  describe("Voter Isolation", function () {
    it("Should mint tokens only to registered voters", async function () {
      const { manager, voter1, voter2, voter3, otherAddress } =
        await deployBallotManager();

      const tx = await manager.createBallot(
        "Test Ballot",
        ["Option 1", "Option 2"],
        [voter1.address, voter2.address, voter3.address],
        100
      );

      // Get the ballot address
      const allBallots = await manager.getAllBallots();
      const ballotAddress = allBallots[0];

      // Get the ballot contract
      const TokenBallotABI = [
        "function voteToken() external view returns (address)",
      ];
      const ballotContract = new ethers.Contract(
        ballotAddress,
        TokenBallotABI,
        ethers.provider
      );
      const tokenAddress = await ballotContract.voteToken();

      // Check balances
      const VoteTokenABI = [
        "function balanceOf(address account) external view returns (uint256)",
      ];
      const tokenContract = new ethers.Contract(
        tokenAddress,
        VoteTokenABI,
        ethers.provider
      );

      expect(await tokenContract.balanceOf(voter1.address)).to.equal(1);
      expect(await tokenContract.balanceOf(voter2.address)).to.equal(1);
      expect(await tokenContract.balanceOf(voter3.address)).to.equal(1);
      expect(await tokenContract.balanceOf(otherAddress.address)).to.equal(0);
    });

    it("Should create independent ballots with different voters", async function () {
      const { manager, voter1, voter2, voter3, voter4 } =
        await deployBallotManager();

      // Create first ballot with voter1 and voter2
      const tx1 = await manager.createBallot(
        "Ballot 1",
        ["Yes", "No"],
        [voter1.address, voter2.address],
        100
      );

      // Create second ballot with voter3 and voter4
      const tx2 = await manager.createBallot(
        "Ballot 2",
        ["A", "B"],
        [voter3.address, voter4.address],
        100
      );

      expect(await manager.getBallotCount()).to.equal(2);

      // Verify both ballots exist and are separate
      const allBallots = await manager.getAllBallots();
      expect(allBallots[0]).to.not.equal(allBallots[1]);
    });
  });
});
