const { expect } = require("chai");
const { defaultFixture } = require("../_fixture");
const { utils } = require("ethers");

const {
  daiUnits,
  trillestUnits,
  usdcUnits,
  isFork,
  loadFixture,
} = require("../helpers");

describe("Token", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should return the token name and symbol", async () => {
    const { trillest } = await loadFixture(defaultFixture);
    expect(await trillest.name()).to.equal("Origin Dollar");
    expect(await trillest.symbol()).to.equal("TRILLEST");
  });

  it("Should have 18 decimals", async () => {
    const { trillest } = await loadFixture(defaultFixture);
    expect(await trillest.decimals()).to.equal(18);
  });

  it("Should return 0 balance for the zero address", async () => {
    const { trillest } = await loadFixture(defaultFixture);
    expect(
      await trillest.balanceOf("0x0000000000000000000000000000000000000000")
    ).to.equal(0);
  });

  it("Should not allow anyone to mint TRILLEST directly", async () => {
    const { trillest, matt } = await loadFixture(defaultFixture);
    await expect(
      trillest.connect(matt).mint(matt.getAddress(), trillestUnits("100"))
    ).to.be.revertedWith("Caller is not the Vault");
    await expect(matt).has.a.balanceOf("100.00", trillest);
  });

  it("Should allow a simple transfer of 1 TRILLEST", async () => {
    const { trillest, anna, matt } = await loadFixture(defaultFixture);
    await expect(anna).has.a.balanceOf("0", trillest);
    await expect(matt).has.a.balanceOf("100", trillest);
    await trillest
      .connect(matt)
      .transfer(anna.getAddress(), trillestUnits("1"));
    await expect(anna).has.a.balanceOf("1", trillest);
    await expect(matt).has.a.balanceOf("99", trillest);
  });

  it("Should allow a transferFrom with an allowance", async () => {
    const { trillest, anna, matt } = await loadFixture(defaultFixture);
    // Approve TRILLEST for transferFrom
    await trillest
      .connect(matt)
      .approve(anna.getAddress(), trillestUnits("1000"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("1000"));

    // Do a transferFrom of TRILLEST
    await trillest
      .connect(anna)
      .transferFrom(
        await matt.getAddress(),
        await anna.getAddress(),
        trillestUnits("1")
      );

    // Anna should have the dollar
    await expect(anna).has.a.balanceOf("1", trillest);

    // Check if it has reflected in allowance
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("999"));
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);

    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));

    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);

    const contractCreditsPerToken = await trillest.creditsBalanceOf(
      mockNonRebasing.address
    );

    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await trillest.creditsBalanceOf(mockNonRebasing.address));

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transfer the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", trillest);
    // Give contract 100 TRILLEST from Matt
    await trillest
      .connect(matt)
      .transfer(mockNonRebasing.address, trillestUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account without previously set creditssPerToken to a rebasing account", async () => {
    let { trillest, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    await mockNonRebasing.transfer(
      await matt.getAddress(),
      trillestUnits("100")
    );
    await expect(matt).has.an.approxBalanceOf("200.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", trillest);
    // Give contract 100 TRILLEST from Matt
    await trillest
      .connect(matt)
      .transfer(mockNonRebasing.address, trillestUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", trillest);
    // Transfer contract balance to Josh
    await mockNonRebasing.transfer(
      await josh.getAddress(),
      trillestUnits("150")
    );
    await expect(matt).has.an.approxBalanceOf("250", trillest);
    await expect(josh).has.an.approxBalanceOf("150", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transfer the correct amount from a non-rebasing account to a non-rebasing account with different previously set creditsPerToken", async () => {
    let {
      trillest,
      vault,
      matt,
      usdc,
      josh,
      mockNonRebasing,
      mockNonRebasingTwo,
    } = await loadFixture(defaultFixture);
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("50"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("50.00", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    await trillest
      .connect(josh)
      .transfer(mockNonRebasingTwo.address, trillestUnits("50"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("100"));
    await vault.rebase();
    await mockNonRebasing.transfer(
      mockNonRebasingTwo.address,
      trillestUnits("10")
    );
    await expect(mockNonRebasing).has.an.approxBalanceOf("40", trillest);
    await expect(mockNonRebasingTwo).has.an.approxBalanceOf("60", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const creditBalanceMockNonRebasing = await trillest.creditsBalanceOf(
      mockNonRebasing.address
    );
    const balanceMockNonRebasing = creditBalanceMockNonRebasing[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasing[1]);
    const creditBalanceMockNonRebasingTwo = await trillest.creditsBalanceOf(
      mockNonRebasingTwo.address
    );
    const balanceMockNonRebasingTwo = creditBalanceMockNonRebasingTwo[0]
      .mul(utils.parseUnits("1", 18))
      .div(creditBalanceMockNonRebasingTwo[1]);

    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(balanceMockNonRebasing)
      .add(balanceMockNonRebasingTwo);

    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account and set creditsPerToken", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give Josh an allowance to move Matt's TRILLEST
    await trillest
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), trillestUnits("100"));
    // Give contract 100 TRILLEST from Matt via Josh
    await trillest
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        trillestUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    const contractCreditsPerToken = await trillest.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Credits per token should be the same for the contract
    contractCreditsPerToken ===
      (await trillest.creditsBalanceOf(mockNonRebasing.address));

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a rebasing account to a non-rebasing account with previously set creditsPerToken", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give Josh an allowance to move Matt's TRILLEST
    await trillest
      .connect(matt)
      .increaseAllowance(await josh.getAddress(), trillestUnits("150"));
    // Give contract 100 TRILLEST from Matt via Josh
    await trillest
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        trillestUnits("50")
      );
    await expect(matt).has.an.approxBalanceOf("50", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Give contract 50 more TRILLEST from Matt via Josh
    await trillest
      .connect(josh)
      .transferFrom(
        await matt.getAddress(),
        mockNonRebasing.address,
        trillestUnits("50")
      );
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account without previously set creditsPerToken to a rebasing account", async () => {
    let { trillest, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      trillestUnits("100")
    );

    await trillest
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        trillestUnits("100")
      );
    await expect(matt).has.an.approxBalanceOf("200.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should transferFrom the correct amount from a non-rebasing account with previously set creditsPerToken to a rebasing account", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("100.00", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // Matt received all the yield
    await expect(matt).has.an.approxBalanceOf("300.00", trillest);
    // Give contract 100 TRILLEST from Matt
    await trillest
      .connect(matt)
      .transfer(mockNonRebasing.address, trillestUnits("50"));
    await expect(matt).has.an.approxBalanceOf("250", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("150.00", trillest);
    // Transfer contract balance to Josh
    await mockNonRebasing.increaseAllowance(
      await matt.getAddress(),
      trillestUnits("150")
    );

    await trillest
      .connect(matt)
      .transferFrom(
        mockNonRebasing.address,
        await matt.getAddress(),
        trillestUnits("150")
      );

    await expect(matt).has.an.approxBalanceOf("400", trillest);
    await expect(josh).has.an.approxBalanceOf("0", trillest);
    await expect(mockNonRebasing).has.an.approxBalanceOf("0", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should maintain the correct balances when rebaseOptIn is called from non-rebasing contract", async () => {
    let { trillest, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 99.50 TRILLEST from Josh
    // This will set a nonrebasingCreditsPerTokenHighres for this account
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("99.50"));

    const initialRebasingCredits = await trillest.rebasingCreditsHighres();
    const initialTotalSupply = await trillest.totalSupply();

    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();

    const totalSupplyBefore = await trillest.totalSupply();
    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", trillest);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing).has.an.approxBalanceOf("99.50", trillest);
    expect(await trillest.totalSupply()).to.equal(totalSupplyBefore);

    const rebasingCredits = await trillest.rebasingCreditsHighres();
    const rebasingCreditsPerTokenHighres =
      await trillest.rebasingCreditsPerTokenHighres();

    const creditsAdded = trillestUnits("99.50")
      .mul(rebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.add(creditsAdded)
    );

    expect(await trillest.totalSupply()).to.approxEqual(
      initialTotalSupply.add(utils.parseUnits("200", 18))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should maintain the correct balance when rebaseOptOut is called from rebasing EOA", async () => {
    let { trillest, vault, matt, usdc } = await loadFixture(defaultFixture);
    await expect(matt).has.an.approxBalanceOf("100.00", trillest);
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    const totalSupplyBefore = await trillest.totalSupply();

    const initialRebasingCredits = await trillest.rebasingCreditsHighres();
    const initialrebasingCreditsPerTokenHighres =
      await trillest.rebasingCreditsPerTokenHighres();

    await trillest.connect(matt).rebaseOptOut();
    // Received 100 from the rebase, the 200 simulated yield was split between
    // Matt and Josh
    await expect(matt).has.an.approxBalanceOf("200.00", trillest);

    const rebasingCredits = await trillest.rebasingCreditsHighres();

    const creditsDeducted = trillestUnits("200")
      .mul(initialrebasingCreditsPerTokenHighres)
      .div(utils.parseUnits("1", 18));

    await expect(rebasingCredits).to.equal(
      initialRebasingCredits.sub(creditsDeducted)
    );

    expect(await trillest.totalSupply()).to.equal(totalSupplyBefore);
  });

  it("Should not allow EOA to call rebaseOptIn when already opted in to rebasing", async () => {
    let { trillest, matt } = await loadFixture(defaultFixture);
    await expect(trillest.connect(matt).rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow EOA to call rebaseOptOut when already opted out of rebasing", async () => {
    let { trillest, matt } = await loadFixture(defaultFixture);
    await trillest.connect(matt).rebaseOptOut();
    await expect(trillest.connect(matt).rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should not allow contract to call rebaseOptIn when already opted in to rebasing", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await mockNonRebasing.rebaseOptIn();
    await expect(mockNonRebasing.rebaseOptIn()).to.be.revertedWith(
      "Account has not opted out"
    );
  });

  it("Should not allow contract to call rebaseOptOut when already opted out of rebasing", async () => {
    let { mockNonRebasing } = await loadFixture(defaultFixture);
    await expect(mockNonRebasing.rebaseOptOut()).to.be.revertedWith(
      "Account has not opted in"
    );
  });

  it("Should maintain the correct balance on a partial transfer for a non-rebasing account without previously set creditsPerToken", async () => {
    let { trillest, matt, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Opt in to rebase so contract doesn't set a fixed creditsPerToken for the contract
    await mockNonRebasing.rebaseOptIn();
    // Give contract 100 TRILLEST from Josh
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("100"));
    await expect(mockNonRebasing).has.an.approxBalanceOf("100", trillest);
    await trillest.connect(matt).rebaseOptOut();
    // Transfer will cause a fixed creditsPerToken to be set for mockNonRebasing
    await mockNonRebasing.transfer(
      await matt.getAddress(),
      trillestUnits("50")
    );
    await expect(mockNonRebasing).has.an.approxBalanceOf("50", trillest);
    await expect(matt).has.an.approxBalanceOf("150", trillest);
    await mockNonRebasing.transfer(
      await matt.getAddress(),
      trillestUnits("25")
    );
    await expect(mockNonRebasing).has.an.approxBalanceOf("25", trillest);
    await expect(matt).has.an.approxBalanceOf("175", trillest);
  });

  it("Should maintain the same totalSupply on many transfers between different account types", async () => {
    let { trillest, matt, josh, mockNonRebasing, mockNonRebasingTwo } =
      await loadFixture(defaultFixture);

    // Only Matt and Josh have TRILLEST, give some to contracts
    await trillest
      .connect(josh)
      .transfer(mockNonRebasing.address, trillestUnits("50"));
    await trillest
      .connect(matt)
      .transfer(mockNonRebasingTwo.address, trillestUnits("50"));

    // Set up accounts
    await trillest.connect(josh).rebaseOptOut();
    const nonRebasingEOA = josh;
    const rebasingEOA = matt;
    const nonRebasingContract = mockNonRebasing;
    await mockNonRebasingTwo.rebaseOptIn();
    const rebasingContract = mockNonRebasingTwo;

    const allAccounts = [
      nonRebasingEOA,
      rebasingEOA,
      nonRebasingContract,
      rebasingContract,
    ];

    const initialTotalSupply = await trillest.totalSupply();
    for (let i = 0; i < 10; i++) {
      for (const fromAccount of allAccounts) {
        const toAccount =
          allAccounts[Math.floor(Math.random() * allAccounts.length)];

        if (typeof fromAccount.transfer === "function") {
          // From account is a contract
          await fromAccount.transfer(
            toAccount.address,
            (await trillest.balanceOf(fromAccount.address)).div(2)
          );
        } else {
          // From account is a EOA
          await trillest
            .connect(fromAccount)
            .transfer(
              toAccount.address,
              (await trillest.balanceOf(fromAccount.address)).div(2)
            );
        }

        await expect(await trillest.totalSupply()).to.equal(initialTotalSupply);
      }
    }
  });

  it("Should revert a transferFrom if an allowance is insufficient", async () => {
    const { trillest, anna, matt } = await loadFixture(defaultFixture);
    // Approve TRILLEST for transferFrom
    await trillest
      .connect(matt)
      .approve(anna.getAddress(), trillestUnits("10"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("10"));

    // Do a transferFrom of TRILLEST
    await expect(
      trillest
        .connect(anna)
        .transferFrom(
          await matt.getAddress(),
          await anna.getAddress(),
          trillestUnits("100")
        )
    ).to.be.revertedWith(
      "Arithmetic operation underflowed or overflowed outside of an unchecked block"
    );
  });

  it("Should allow to increase/decrease allowance", async () => {
    const { trillest, anna, matt } = await loadFixture(defaultFixture);
    // Approve TRILLEST
    await trillest
      .connect(matt)
      .approve(anna.getAddress(), trillestUnits("1000"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("1000"));

    // Decrease allowance
    await trillest
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), trillestUnits("100"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("900"));

    // Increase allowance
    await trillest
      .connect(matt)
      .increaseAllowance(await anna.getAddress(), trillestUnits("20"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("920"));

    // Decrease allowance more than what's there
    await trillest
      .connect(matt)
      .decreaseAllowance(await anna.getAddress(), trillestUnits("950"));
    expect(
      await trillest.allowance(await matt.getAddress(), await anna.getAddress())
    ).to.equal(trillestUnits("0"));
  });

  it("Should increase users balance on supply increase", async () => {
    const { trillest, usdc, vault, anna, matt } = await loadFixture(
      defaultFixture
    );
    // Transfer 1 to Anna, so we can check different amounts
    await trillest
      .connect(matt)
      .transfer(anna.getAddress(), trillestUnits("1"));
    await expect(matt).has.a.balanceOf("99", trillest);
    await expect(anna).has.a.balanceOf("1", trillest);

    // Increase total supply thus increasing all user's balances
    await usdc.connect(matt).mint(usdcUnits("2"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("2"));
    await vault.rebase();

    // Contract originally contained $200, now has $202.
    // Matt should have (99/200) * 202 TRILLEST
    await expect(matt).has.a.balanceOf("99.99", trillest);
    // Anna should have (1/200) * 202 TRILLEST
    await expect(anna).has.a.balanceOf("1.01", trillest);
  });

  it("Should mint correct amounts on non-rebasing account without previously set creditsPerToken", async () => {
    let { trillest, dai, vault, josh, mockNonRebasing } = await loadFixture(
      defaultFixture
    );
    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", trillest);
    const totalSupplyBefore = await trillest.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    await mockNonRebasing.mintTrillest(
      vault.address,
      dai.address,
      daiUnits("50")
    );
    await expect(await trillest.totalSupply()).to.equal(
      totalSupplyBefore.add(trillestUnits("50"))
    );

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await trillest.nonRebasingSupply()).to.approxEqual(
      trillestUnits("50")
    );
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should mint correct amounts on non-rebasing account with previously set creditsPerToken", async () => {
    let { trillest, dai, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", trillest);
    const totalSupplyBefore = await trillest.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    await mockNonRebasing.mintTrillest(
      vault.address,
      dai.address,
      daiUnits("50")
    );
    await expect(await trillest.totalSupply()).to.equal(
      totalSupplyBefore.add(trillestUnits("50"))
    );
    const contractCreditsBalanceOf = await trillest.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await trillest.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Mint again
    await mockNonRebasing.mintTrillest(
      vault.address,
      dai.address,
      daiUnits("50")
    );
    await expect(await trillest.totalSupply()).to.equal(
      // Note 200 additional from simulated yield
      totalSupplyBefore.add(trillestUnits("100")).add(trillestUnits("200"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("100", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await trillest.nonRebasingSupply()).to.approxEqual(
      trillestUnits("100")
    );
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should burn the correct amount for non-rebasing account", async () => {
    let { trillest, dai, vault, matt, usdc, josh, mockNonRebasing } =
      await loadFixture(defaultFixture);
    // Give contract 100 DAI from Josh
    await dai.connect(josh).transfer(mockNonRebasing.address, daiUnits("100"));
    await expect(mockNonRebasing).has.a.balanceOf("0", trillest);
    const totalSupplyBefore = await trillest.totalSupply();
    await mockNonRebasing.approveFor(
      dai.address,
      vault.address,
      daiUnits("100")
    );
    await mockNonRebasing.mintTrillest(
      vault.address,
      dai.address,
      daiUnits("50")
    );
    await expect(await trillest.totalSupply()).to.equal(
      totalSupplyBefore.add(trillestUnits("50"))
    );
    const contractCreditsBalanceOf = await trillest.creditsBalanceOf(
      mockNonRebasing.address
    );
    // Transfer USDC into the Vault to simulate yield
    await usdc.connect(matt).transfer(vault.address, usdcUnits("200"));
    await vault.rebase();
    // After the initial transfer and the rebase the contract address has a
    // separate and different creditsPerToken to the global one
    expect(
      (await trillest.creditsBalanceOf(await josh.getAddress()))[1]
    ).to.not.equal(contractCreditsBalanceOf[1]);
    // Burn TRILLEST
    await mockNonRebasing.redeemTrillest(vault.address, trillestUnits("25"));
    await expect(await trillest.totalSupply()).to.equal(
      // Note 200 from simulated yield
      totalSupplyBefore.add(trillestUnits("225"))
    );
    await expect(mockNonRebasing).has.a.balanceOf("25", trillest);

    // Validate rebasing and non rebasing credit accounting by calculating'
    // total supply manually
    await expect(await trillest.nonRebasingSupply()).to.approxEqual(
      trillestUnits("25")
    );
    const calculatedTotalSupply = (await trillest.rebasingCreditsHighres())
      .mul(utils.parseUnits("1", 18))
      .div(await trillest.rebasingCreditsPerTokenHighres())
      .add(await trillest.nonRebasingSupply());
    await expect(calculatedTotalSupply).to.approxEqual(
      await trillest.totalSupply()
    );
  });

  it("Should exact transfer to new contract accounts", async () => {
    let { trillest, vault, matt, usdc, mockNonRebasing } = await loadFixture(
      defaultFixture
    );

    // Add yield to so we need higher resolution
    await usdc.connect(matt).mint(usdcUnits("9671.2345"));
    await usdc.connect(matt).transfer(vault.address, usdcUnits("9671.2345"));
    await vault.rebase();

    // Helper to verify balance-exact transfers in
    const checkTransferIn = async (amount) => {
      const beforeReceiver = await trillest.balanceOf(mockNonRebasing.address);
      await trillest.connect(matt).transfer(mockNonRebasing.address, amount);
      const afterReceiver = await trillest.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.add(amount)).to.equal(afterReceiver);
    };

    // Helper to verify balance-exact transfers out
    const checkTransferOut = async (amount) => {
      const beforeReceiver = await trillest.balanceOf(mockNonRebasing.address);
      await mockNonRebasing.transfer(matt.address, amount);
      const afterReceiver = await trillest.balanceOf(mockNonRebasing.address);
      expect(beforeReceiver.sub(amount)).to.equal(afterReceiver);
    };

    // In
    await checkTransferIn(1);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);
    await checkTransferIn(100);
    await checkTransferIn(2);
    await checkTransferIn(5);
    await checkTransferIn(9);

    // Out
    await checkTransferOut(1);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
    await checkTransferOut(100);
    await checkTransferOut(2);
    await checkTransferOut(5);
    await checkTransferOut(9);
  });
});
