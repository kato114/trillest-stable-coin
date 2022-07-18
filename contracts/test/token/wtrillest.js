const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");

const { trillestUnits, daiUnits, isFork, loadFixture } = require("../helpers");

describe("WTRILLEST", function () {
  if (isFork) {
    this.timeout(0);
  }

  let trillest, wtrillest, vault, dai, matt, josh, governor;

  beforeEach(async () => {
    const fixture = await loadFixture(defaultFixture);
    trillest = fixture.trillest;
    wtrillest = fixture.wtrillest;
    vault = fixture.vault;
    dai = fixture.dai;
    matt = fixture.matt;
    josh = fixture.josh;
    governor = fixture.governor;

    // Josh wraps 50
    await trillest
      .connect(josh)
      .approve(wtrillest.address, trillestUnits("1000"));
    await wtrillest.connect(josh).deposit(trillestUnits("50"), josh.address);
    // Matt gives money to wTRILLEST, which counts as yield and changes the effective price of WTRILLEST
    // 1 WTRILLEST will be worth 2 TRILLEST
    await trillest
      .connect(matt)
      .transfer(wtrillest.address, trillestUnits("50"));
  });

  describe("Funds in, Funds out", async () => {
    it("should deposit at the correct ratio", async () => {
      await wtrillest.connect(josh).deposit(trillestUnits("50"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wtrillest);
      await expect(josh).to.have.a.balanceOf("0", trillest);
    });
    it("should withdraw at the correct ratio", async () => {
      await wtrillest
        .connect(josh)
        .withdraw(trillestUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("25", wtrillest);
      await expect(josh).to.have.a.balanceOf("100", trillest);
    });
    it("should mint at the correct ratio", async () => {
      await wtrillest.connect(josh).mint(trillestUnits("25"), josh.address);
      await expect(josh).to.have.a.balanceOf("75", wtrillest);
      await expect(josh).to.have.a.balanceOf("0", trillest);
    });
    it("should redeem at the correct ratio", async () => {
      await expect(josh).to.have.a.balanceOf("50", wtrillest);
      await wtrillest
        .connect(josh)
        .redeem(trillestUnits("50"), josh.address, josh.address);
      await expect(josh).to.have.a.balanceOf("0", wtrillest);
      await expect(josh).to.have.a.balanceOf("150", trillest);
    });
  });

  describe("Collects Rebase", async () => {
    it("should increase with an TRILLEST rebase", async () => {
      await expect(wtrillest).to.have.approxBalanceOf("100", trillest);
      await dai.connect(josh).transfer(vault.address, daiUnits("100"));
      await vault.rebase();
      await expect(wtrillest).to.have.approxBalanceOf("150", trillest);
    });
  });

  describe("Check proxy", async () => {
    it("should have correct ERC20 properties", async () => {
      expect(await wtrillest.decimals()).to.eq(18);
      expect(await wtrillest.name()).to.eq("Wrapped TRILLEST");
      expect(await wtrillest.symbol()).to.eq("WTRILLEST");
    });
  });

  describe("Token recovery", async () => {
    it("should allow a governor to recover tokens", async () => {
      await dai.connect(matt).transfer(wtrillest.address, daiUnits("2"));
      await expect(wtrillest).to.have.a.balanceOf("2", dai);
      await expect(governor).to.have.a.balanceOf("1000", dai);
      await wtrillest
        .connect(governor)
        .transferToken(dai.address, daiUnits("2"));
      await expect(wtrillest).to.have.a.balanceOf("0", dai);
      await expect(governor).to.have.a.balanceOf("1002", dai);
    });
    it("should not allow a governor to collect TRILLEST", async () => {
      await expect(
        wtrillest
          .connect(governor)
          .transferToken(trillest.address, trillestUnits("2"))
      ).to.be.revertedWith("Cannot collect TRILLEST");
    });
    it("should not allow a non governor to recover tokens ", async () => {
      await expect(
        wtrillest
          .connect(josh)
          .transferToken(trillest.address, trillestUnits("2"))
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("WTRILLEST upgrade", async () => {
    it("should be upgradable", async () => {
      // Do upgrade
      const cWrappedTRILLESTProxy = await ethers.getContract(
        "WrappedTRILLESTProxy"
      );
      const factory = await ethers.getContractFactory(
        "MockLimitedWrappedTrillest"
      );
      const dNewImpl = await factory.deploy(
        trillest.address,
        "WTRILLEST",
        "Wrapped TRILLEST"
      );
      await cWrappedTRILLESTProxy.connect(governor).upgradeTo(dNewImpl.address);

      // Test basics
      expect(await wtrillest.decimals()).to.eq(18);
      expect(await wtrillest.name()).to.eq("Wrapped TRILLEST");
      expect(await wtrillest.symbol()).to.eq("WTRILLEST");

      // Test previous balance
      await expect(wtrillest).to.have.a.balanceOf("100", trillest);
      await expect(josh).to.have.a.balanceOf("50", wtrillest);
      await expect(matt).to.have.a.balanceOf("0", wtrillest);

      // Upgraded contract will only allow deposits of up to 1 TRILLEST
      await wtrillest.connect(josh).deposit(trillestUnits("1"), josh.address);
      await expect(
        wtrillest.connect(josh).deposit(trillestUnits("25"), josh.address)
      ).to.be.revertedWith("ERC4626: deposit more then max");
    });
  });
});
