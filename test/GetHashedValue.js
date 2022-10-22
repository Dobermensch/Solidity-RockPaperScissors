const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GetHashedValue contract", function () {
  it("should give a bytes32 hash of the values I pass to it", async function() {
    const hashedContractFactory = await ethers.getContractFactory("GetHashedValue");

    const hashContract = await hashedContractFactory.deploy();

    // 0x0000000000000000000000000000000000000000000000000000007465737432 are bytes of "test2"
    // 0x0000000000000000000000000000000000000000000000000000000074657374 are bytes of "test"
    const hashedInputPaper = await hashContract.getHashedValue(2, "0x0000000000000000000000000000000000000000000000000000007465737432");
    const hashedInputRock = await hashContract.getHashedValue(1, "0x0000000000000000000000000000000000000000000000000000000074657374");

    await expect(hashedInputPaper).to.eq("0x566d7dd4e9dc72e9beef887f2982703a0d0f9dd1b6505ee3ff5310c7383637bd");
    await expect(hashedInputRock).to.eq("0x47acd774e7ec37700c62d673f8e65af9b86d04a3502d19659b6f07fbbcc20201");
  });
})