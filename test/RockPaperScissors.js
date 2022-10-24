const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const provider = waffle.provider;
const hashedInputRock = "0x47acd774e7ec37700c62d673f8e65af9b86d04a3502d19659b6f07fbbcc20201";
const hashedInputPaper = "0x566d7dd4e9dc72e9beef887f2982703a0d0f9dd1b6505ee3ff5310c7383637bd";
const testBytes = "0x0000000000000000000000000000000000000000000000000000000074657374"
const test2Bytes = "0x0000000000000000000000000000000000000000000000000000007465737432"

describe("RPS contract", function () {
  async function deployContractFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const rps = await ethers.getContractFactory("RockPaperScissors");

    const rpsContract = await rps.deploy();

    return { rpsContract, owner, addr1, addr2 };
  };

  describe("joining the game", function () {
    let rpsContract, owner, addr1, addr2;
    before(async function(){
      const result = await loadFixture(
        deployContractFixture
      );

      rpsContract = result.rpsContract;
      owner = result.owner;
      addr1 = result.addr1;
      addr2 = result.addr2;
    });

    it("Should let first player join the game", async function () {
      const res = await rpsContract.connect(owner).join({value: ethers.utils.parseEther("0.1")});
      const ownerAddress = owner.address;

      await expect(res)
      .to.emit(rpsContract, "PlayerJoined")
      .withArgs(ownerAddress);

      expect(await rpsContract.playerOne()).to.eq(ownerAddress);
    });

    it("Should not let second player join the game with invalid bet", async function () {
      await expect(
        rpsContract.connect(addr1).join({value: ethers.utils.parseEther("0.05")})
      ).to.be.revertedWith('Your bet amount needs to be greater than or equal to the initialBet')

      expect(await rpsContract.playerTwo()).to.eq("0x0000000000000000000000000000000000000000");
    });

    it("Should let second player join the game with valid bet", async function () {
      const res = await rpsContract.connect(addr1).join({value: ethers.utils.parseEther("0.1")});
      const secondAddress = addr1.address;

      await expect(res)
      .to.emit(rpsContract, "PlayerJoined")
      .withArgs(secondAddress);

      expect(await rpsContract.playerTwo()).to.eq(secondAddress);
    });

    it("Should not let any more people join the game", async function () {
      await rpsContract.connect(addr2).join({value: ethers.utils.parseEther("0.1")});

      expect(await rpsContract.playerOne()).to.not.eq(addr2.address);
      expect(await rpsContract.playerTwo()).to.not.eq(addr2.address);
    });
  });

  describe("play game", function() {
    let rpsContract, owner, addr1, addr2;
    before(async function(){
      const result = await loadFixture(
        deployContractFixture
      );

      rpsContract = result.rpsContract;
      owner = result.owner;
      addr1 = result.addr1;
      addr2 = result.addr2;
    });

    it("Should revert no one has joined to play game", async function () {
      await expect(
        rpsContract.connect(owner).playGame("0x6b6b4b25394a4afb18e586cbff22f7be20c3187d1acb6e6d6e6bc16920e118da")
      ).to.be.revertedWith('Game needs more players to join first')
    });

    it("Should store player one's encrypted move", async function () {
      await rpsContract.connect(owner).join({value: ethers.utils.parseEther("0.1")});
      await rpsContract.connect(addr1).join({value: ethers.utils.parseEther("0.1")});

      await expect(
        rpsContract.connect(owner).playGame(hashedInputRock)
      )
      .to.emit(rpsContract, "PlayerMadeMove")
      .withArgs(owner.address);

      expect(await rpsContract.hashedPlayerOneMove()).to.eq(hashedInputRock);
    });

    it("Should revert when Player 3 tries to play game", async function () {
      await expect(
        rpsContract.connect(addr2).playGame(hashedInputRock)
      ).to.be.revertedWith('You did not join the game as a player')
    });

    it("Should store player two's encrypted move", async function () {
      await expect(
        rpsContract.connect(addr1).playGame(hashedInputPaper)
      )
      .to.emit(rpsContract, "PlayerMadeMove")
      .withArgs(addr1.address);

      expect(await rpsContract.hashedPlayerTwoMove()).to.eq(hashedInputPaper);
    });
  });

  describe("reveal player choice", function() {
    let rpsContract, owner, addr1, addr2;
    before(async function(){
      const result = await loadFixture(
        deployContractFixture
      );

      rpsContract = result.rpsContract;
      owner = result.owner;
      addr1 = result.addr1;
      addr2 = result.addr2;

      await rpsContract.connect(owner).join({value: ethers.utils.parseEther("0.1")});
      await rpsContract.connect(addr1).join({value: ethers.utils.parseEther("0.1")});
    });

    it("should revert with an error if one player hasn't sent the move", async function() {
      await rpsContract.connect(owner).playGame(hashedInputPaper);

      await expect(
        rpsContract.connect(owner).revealPlayerChoice(1, testBytes)
      ).to.be.revertedWith("The game is still running!");
    });

    it("should save the first player's move if the player sent the correct constituents of the initial hashed move", async function() {
      await rpsContract.connect(addr1).playGame(hashedInputRock);

      await rpsContract.connect(owner).revealPlayerChoice(2, test2Bytes);

      expect(await rpsContract.playerOneMove()).to.eq(2);
    });

    it("should not save the player's move if the player sent incorrect constituents from intial hashed move", async function() {
      const test3Bytes = "0x0000000000000000000000000000000000000000000000000000007465737433"

      await rpsContract.connect(addr1).revealPlayerChoice(3, test3Bytes);

      expect(await rpsContract.playerTwoMove()).to.eq(0);
    });

    it("Should end game if both players have revealed their moves and there is a winner", async function() {
      const ownerBalance = (await provider.getBalance(owner.address)).toString();

      const playerTwoReveal = await rpsContract.connect(addr1).revealPlayerChoice(1, testBytes);

      const receipt = await playerTwoReveal.wait();

      const ownerBalanceNew = (await provider.getBalance(owner.address)).toString();
      const ownerBalanceDiff = ownerBalanceNew - ownerBalance;

      await expect(
        playerTwoReveal
      ).to.emit(rpsContract, "GameOver")

      expect(ownerBalanceDiff).to.be.greaterThanOrEqual(199999999990000000);

      expect(await rpsContract.playerOneMove()).to.eq(0);
      expect(await rpsContract.playerTwoMove()).to.eq(0);

      expect(receipt.events.length).to.eq(1);
      expect(receipt.events[0].args[0].length).to.eq(3);
      expect(receipt.events[0].args[0][0]).to.eq("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"); // playerOne
      expect(receipt.events[0].args[0][1]).to.eq("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"); // playerTwo
      expect(receipt.events[0].args[0][2]).to.eq(1); // outcome -> player 1 won
    });

    it("Should reset the game after both players have revealed their choices", async function() {
      expect(await rpsContract.playerOne()).to.eq("0x0000000000000000000000000000000000000000");
      expect(await rpsContract.playerTwo()).to.eq("0x0000000000000000000000000000000000000000");
      expect(await rpsContract.playerOneMove()).to.eq(0);
      expect(await rpsContract.playerTwoMove()).to.eq(0);
      expect(await rpsContract.hashedPlayerOneMove()).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(await rpsContract.hashedPlayerTwoMove()).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
      expect(await rpsContract.firstReveal()).to.eq(0);
    });

    it("Should save the game result in the gamesPlayedResults array", async function() {
      const result = await rpsContract.getHistoricalGameAtIndex(0);
      expect(result[0]).to.eq(owner.address);
      expect(result[1]).to.eq(addr1.address);
      expect(result[2]).to.eq(1);

      await expect(
        rpsContract.getHistoricalGameAtIndex(1)
      ).to.be.revertedWith('Please enter a valid index');
    });

    it ("should give both the users their money back when there is a draw game", async function() {
      const { rpsContract, owner, addr1 } = await loadFixture(
        deployContractFixture
      );

      const ownerBalance = ethers.utils.formatEther((await provider.getBalance(owner.address)).toString());
      const addr1Balance = ethers.utils.formatEther((await provider.getBalance(addr1.address)).toString());

      await rpsContract.connect(owner).join({value: ethers.utils.parseEther("1")});
      await rpsContract.connect(addr1).join({value: ethers.utils.parseEther("1")});

      await rpsContract.connect(owner).playGame(hashedInputPaper);
      await rpsContract.connect(addr1).playGame(hashedInputPaper);

      await rpsContract.connect(owner).revealPlayerChoice(2, test2Bytes);
      await rpsContract.connect(addr1).revealPlayerChoice(2, test2Bytes);

      const ownerBalanceNew = ethers.utils.formatEther((await provider.getBalance(owner.address)).toString());
      const addr1BalanceNew = ethers.utils.formatEther((await provider.getBalance(addr1.address)).toString());

      expect(Math.ceil(ownerBalance)).to.eq(Math.ceil(ownerBalanceNew));
      expect(Math.ceil(addr1Balance)).to.eq(Math.ceil(addr1BalanceNew));
    });

    it ("Should penalize the player who hasn't revealed choice in 10 minutes", async function() {
      const { rpsContract, owner, addr1 } = await loadFixture(
        deployContractFixture
      );

      const ownerBalance = ethers.utils.formatEther((await provider.getBalance(owner.address)).toString());

      await rpsContract.connect(owner).join({value: ethers.utils.parseEther("1")});
      await rpsContract.connect(addr1).join({value: ethers.utils.parseEther("1")});

      await rpsContract.connect(owner).playGame(hashedInputPaper);
      await rpsContract.connect(addr1).playGame(hashedInputRock);

      await rpsContract.connect(owner).revealPlayerChoice(2, test2Bytes);
      // revealed again within max reveal time, nothing happens
      await rpsContract.connect(owner).revealPlayerChoice(2, test2Bytes);

      expect(await rpsContract.playerOneMove()).to.eq(2); // game wasn't reset

      await provider.send("evm_increaseTime", [3600]) // an hour later...
      await provider.send("evm_mine")

      await rpsContract.connect(owner).revealPlayerChoice(2, test2Bytes); // player can retrigger the reveal choice

      const ownerBalanceNew = ethers.utils.formatEther((await provider.getBalance(owner.address)).toString());

      const ownerBalanceDiff = ownerBalanceNew - ownerBalance;

      expect(parseFloat(ownerBalanceDiff)).to.be.greaterThanOrEqual(0.99); // get both joined players' balance
      expect(await rpsContract.playerOneMove()).to.eq(0); // game was reset
    });
  });
});