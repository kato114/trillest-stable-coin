const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");
const parseUnits = utils.parseUnits;
const {
  trillestUnits,
  usdcUnits,
  advanceTime,
  loadFixture,
  isGanacheFork,
} = require("../helpers");

describe("Compensation Claims", async () => {
  if (isGanacheFork) {
    this.timeout(0);
  }

  let fixture;

  const expectTotalClaims = async (compensationClaims, amount) => {
    expect(await compensationClaims.totalClaims()).to.equal(
      trillestUnits(amount),
      "Totals"
    );
  };

  const fundClaims = async (amount) => {
    const { usdc, josh, vault, trillest, compensationClaims } = fixture;
    const compAddr = compensationClaims.address;
    await usdc.connect(josh).mint(usdcUnits(amount));
    await usdc.connect(josh).approve(vault.address, usdcUnits(amount));
    await vault.connect(josh).mint(usdc.address, usdcUnits(amount), 0);
    await trillest.connect(josh).transfer(compAddr, trillestUnits(amount));
  };

  const setClaims = async (claims) => {
    const { governor, adjuster, compensationClaims } = fixture;
    let accounts = [];
    let amounts = [];
    for (const row of claims) {
      accounts.push(await row[0].getAddress());
      amounts.push(trillestUnits(row[1]));
    }
    await compensationClaims.connect(governor).unlockAdjuster();
    await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
  };

  describe("User claims", async () => {
    let governor, adjuster, matt, josh, anna, trillest, compensationClaims;

    beforeEach(async () => {
      fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      josh = fixture.josh;
      anna = fixture.anna;
      trillest = fixture.trillest;
      compensationClaims = fixture.compensationClaims;

      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amounts = [
        trillestUnits("4.000000000072189"),
        trillestUnits("56400000.1234"),
      ];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await compensationClaims.connect(governor).lockAdjuster();

      await fundClaims("57500000");
    });

    it("should show a user their funds, and a total of all funds", async () => {
      await expect(anna).to.have.a.balanceOf(
        "4.000000000072189",
        compensationClaims
      );
      await expectTotalClaims(compensationClaims, "56400004.123400000072189");
    });
    it("should show a zero for a user without a claim", async () => {
      await expect(josh).to.have.a.balanceOf("0", compensationClaims);
    });
    it("should allow a user to make claim after the start of the claim period", async () => {
      await expect(anna).to.have.a.balanceOf(
        "4.000000000072189",
        compensationClaims
      );
      await expectTotalClaims(compensationClaims, "56400004.123400000072189");
      await compensationClaims.connect(governor).start(1000);
      await compensationClaims.connect(anna).claim(await anna.getAddress());
      await expect(anna).to.have.a.balanceOf("0", compensationClaims);
      await expectTotalClaims(compensationClaims, "56400000.1234");
      await expect(anna).to.have.a.balanceOf("4.000000000072189", trillest);
    });
    it("should allow a user to withdraw their funds just before the end of the claim period", async () => {
      await compensationClaims.connect(governor).start(1000);
      await advanceTime(990);
      await compensationClaims.connect(anna).claim(await anna.getAddress());
      await expect(anna).to.have.a.balanceOf("0", compensationClaims);
      await expect(anna).to.have.a.balanceOf("4.000000000072189", trillest);
    });
    it("should not allow a user to withdraw their funds before the claim period", async () => {
      const tx = compensationClaims
        .connect(anna)
        .claim(await anna.getAddress());
      await expect(tx).to.be.revertedWith("Should be in claim period");
    });
    it("should not allow a user to withdraw their funds after the claim period", async () => {
      await compensationClaims.connect(governor).start(1000);
      await advanceTime(1002);
      const tx = compensationClaims
        .connect(anna)
        .claim(await anna.getAddress());
      await expect(tx).to.be.revertedWith("Should be in claim period");
    });
    it("should throw if the user never had a claim", async () => {
      await compensationClaims.connect(governor).start(1000);
      const tx = compensationClaims
        .connect(anna)
        .claim(await josh.getAddress());
      await expect(tx).to.be.revertedWith("Amount must be greater than 0");
    });
    it("should throw if the user has already claimed their funds", async () => {
      await compensationClaims.connect(governor).start(1000);
      await compensationClaims.connect(anna).claim(await anna.getAddress()); // first claim
      const tx = compensationClaims
        .connect(anna)
        .claim(await anna.getAddress()); // second claim
      await expect(tx).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Adjuster", async () => {
    let governor, adjuster, matt, anna, compensationClaims;

    beforeEach(async () => {
      fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      anna = fixture.anna;
      compensationClaims = fixture.compensationClaims;
    });

    it("should set one claim amount", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await expect(anna).to.have.a.balanceOf("20", compensationClaims);
      await expectTotalClaims(compensationClaims, "20");
    });
    it("should set multiple claim amounts", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amounts = [trillestUnits("40.0023"), trillestUnits("0.000091")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(adjuster).setClaims(accounts, amounts);
      await expect(anna).to.have.a.balanceOf("40.0023", compensationClaims);
      await expect(matt).to.have.a.balanceOf("0.000091", compensationClaims);
      await expectTotalClaims(compensationClaims, "40.002391");
    });
    it("should be able to set same account twice, and have the totals be correct", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amountsOne = [trillestUnits("40.0023"), trillestUnits("0.000091")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims
        .connect(adjuster)
        .setClaims(accounts, amountsOne);
      const amountsTwo = [
        trillestUnits("1.000091"),
        trillestUnits("4000000.00"),
      ];
      await compensationClaims
        .connect(adjuster)
        .setClaims(accounts, amountsTwo);

      await expect(anna).to.have.a.balanceOf("1.000091", compensationClaims);
      await expect(matt).to.have.a.balanceOf("4000000.00", compensationClaims);
      await expectTotalClaims(compensationClaims, "4000001.000091");
    });
    it("should not be able to overflow the total amount", async () => {
      const accounts = [await anna.getAddress(), await matt.getAddress()];
      const amounts = [parseUnits("1.1", 77), parseUnits("1", 77)];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith(
        "Arithmetic operation underflowed or overflowed outside of an unchecked block"
      );
    });
    it("should not be able to set mismatching addresses and amounts", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20"), trillestUnits("40")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Addresses and amounts must match");
    });

    it("should not be able to set claims before being unlocked", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20")];
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Adjuster must be unlocked");
    });
    it("should not be able to set claims after being locked", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(governor).lockAdjuster();
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Adjuster must be unlocked");
    });
    it("should not be able to set claims during the claim period", async () => {
      await setClaims([[anna, "44"]]);
      await fundClaims("44");
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await compensationClaims.connect(governor).start(100);
      await expect(
        compensationClaims.connect(adjuster).setClaims(accounts, amounts)
      ).to.be.revertedWith("Should not be in claim period");
    });
    it("no one else should be able to set one claim amount", async () => {
      const accounts = [await anna.getAddress()];
      const amounts = [trillestUnits("20")];
      await compensationClaims.connect(governor).unlockAdjuster();
      await expect(
        compensationClaims.connect(anna).setClaims(accounts, amounts)
      ).to.be.revertedWith("Must be adjuster");
    });
  });

  describe("Governor", async () => {
    let governor,
      adjuster,
      matt,
      josh,
      anna,
      trillest,
      usdc,
      compensationClaims;
    beforeEach(async () => {
      fixture = await loadFixture(defaultFixture);
      governor = fixture.governor;
      adjuster = fixture.adjuster;
      matt = fixture.matt;
      josh = fixture.josh;
      anna = fixture.anna;
      trillest = fixture.trillest;
      usdc = fixture.usdc;
      compensationClaims = fixture.compensationClaims;
    });

    describe("Adjuster locking and unlocking", async () => {
      it("should unlock adjuster", async () => {
        await compensationClaims.connect(governor).unlockAdjuster();
        expect(await compensationClaims.isAdjusterLocked()).to.be.false;
      });
      it("should lock adjuster", async () => {
        await compensationClaims.connect(governor).lockAdjuster();
        expect(await compensationClaims.isAdjusterLocked()).to.be.true;
      });
      it("should not unlock during claims period", async () => {
        await setClaims([[anna, "1"]]); // Must have a claim to start
        await fundClaims("1");
        await compensationClaims.connect(governor).start(1000);
        const tx = compensationClaims.connect(governor).unlockAdjuster();
        await expect(tx).to.be.revertedWith("Should not be in claim period");
      });
      it("should not lock during claims period", async () => {
        await setClaims([[anna, "1"]]); // Must have a claim to start
        await fundClaims("1");
        await compensationClaims.connect(governor).start(1000);
        const tx = compensationClaims.connect(governor).lockAdjuster();
        await expect(tx).to.be.revertedWith("Should not be in claim period");
      });
      it("should not let anyone one else unlock", async () => {
        const tx = compensationClaims.connect(adjuster).unlockAdjuster();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      });
      it("should not let anyone one else lock", async () => {
        const tx = compensationClaims.connect(adjuster).lockAdjuster();
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      });
    });

    describe("Start claims period", async () => {
      it("should be able to start a claims period", async () => {
        const accounts = [await anna.getAddress(), await matt.getAddress()];
        const amounts = [
          trillestUnits("4.000000000072189"),
          trillestUnits("56400000.1234"),
        ];
        await compensationClaims.connect(governor).unlockAdjuster();
        await compensationClaims.connect(adjuster).setClaims(accounts, amounts);

        await fundClaims("57500000");
        await compensationClaims.connect(governor).start(1000);
      });

      it("should not be able to start a claims period with insufficient funds", async () => {
        const accounts = [await anna.getAddress(), await matt.getAddress()];
        const amounts = [
          trillestUnits("4.000000000072189"),
          trillestUnits("56400000.1234"),
        ];
        await compensationClaims.connect(governor).unlockAdjuster();
        await compensationClaims.connect(adjuster).setClaims(accounts, amounts);

        await fundClaims("47500000");
        const tx = compensationClaims.connect(governor).start(1000);
        await expect(tx).to.be.revertedWith(
          "Insufficient funds for all claims"
        );
      });

      it("should not be able to start a claims period if a claim period is running", async () => {
        const accounts = [await anna.getAddress(), await matt.getAddress()];
        const amounts = [
          trillestUnits("4.000000000072189"),
          trillestUnits("56400000.1234"),
        ];
        await compensationClaims.connect(governor).unlockAdjuster();
        await compensationClaims.connect(adjuster).setClaims(accounts, amounts);

        await fundClaims("57500000");
        await compensationClaims.connect(governor).start(1000); // First start

        const tx = compensationClaims.connect(governor).start(1000); // Second start
        await expect(tx).to.be.revertedWith("Should not be in claim period");
      });

      it("should not be able to start a claims period if end time is too far in the future", async () => {
        const accounts = [await anna.getAddress(), await matt.getAddress()];
        const amounts = [
          trillestUnits("4.000000000072189"),
          trillestUnits("56400000.1234"),
        ];
        await compensationClaims.connect(governor).unlockAdjuster();
        await compensationClaims.connect(adjuster).setClaims(accounts, amounts);

        await fundClaims("57500000");
        const yearAndAMonth = (365 + 30) * 24 * 60 * 60;
        const tx = compensationClaims.connect(governor).start(yearAndAMonth);
        await expect(tx).to.be.revertedWith("Duration too long");
      });

      it("should not be able to start a claims period if there are no claims", async () => {
        await fundClaims("57500000");
        const tx = compensationClaims.connect(governor).start(1000); // Second start
        await expect(tx).to.be.revertedWith("No claims");
      });

      it("no one else can start", async () => {
        await setClaims([[josh, "1"]]);
        await fundClaims("1");
        const tx = compensationClaims.connect(adjuster).start(1000);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      });
    });

    describe("Collect", async () => {
      it("should be able to collect before claims period", async () => {
        await setClaims([[josh, "1"]]);
        await fundClaims("1000000000.155");
        await expect(governor).to.have.a.balanceOf("0", trillest);
        await compensationClaims.connect(governor).collect(trillest.address);
        await expect(governor).to.have.a.balanceOf("1000000000.155", trillest);
      });
      it("should be able to collect after claims period", async () => {
        await setClaims([[josh, "1"]]);
        await fundClaims("1000000000.155");
        await compensationClaims.connect(governor).start(1000);
        await advanceTime(1010);
        await expect(governor).to.have.a.balanceOf("0", trillest);
        await compensationClaims.connect(governor).collect(trillest.address);
        await expect(governor).to.have.a.balanceOf("1000000000.155", trillest);
      });
      it("should be able to collect any coin", async () => {
        await usdc.connect(josh).mint(usdcUnits("100.111"));
        await usdc
          .connect(josh)
          .transfer(compensationClaims.address, usdcUnits("100.111"));

        await expect(governor).to.have.a.balanceOf("1000", usdc);
        await compensationClaims.connect(governor).collect(usdc.address);
        await expect(governor).to.have.a.balanceOf("1100.111", usdc);
      });
      it("should not be able to collect during claims period", async () => {
        await setClaims([[josh, "1"]]);
        await fundClaims("1000000000.155");
        await expect(governor).to.have.a.balanceOf("0", trillest);
        await compensationClaims.connect(governor).start(120);
        const tx = compensationClaims
          .connect(governor)
          .collect(trillest.address);
        await expect(tx).to.be.revertedWith("Should not be in claim period");
      });
      it("no one else can collect", async () => {
        await setClaims([[josh, "1"]]);
        await fundClaims("1000000000.155");
        await expect(governor).to.have.a.balanceOf("0", trillest);
        const tx = compensationClaims
          .connect(adjuster)
          .collect(trillest.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      });
    });
  });
});
