const hre = require("hardhat");

const {
  isMainnet,
  isFork,
  isRinkeby,
  isMainnetOrRinkebyOrFork,
} = require("../test/helpers.js");
const {
  log,
  deployWithConfirmation,
  withConfirmation,
  executeProposal,
  sendProposal,
} = require("../utils/deploy");
const { proposeArgs } = require("../utils/governor");
const { getTxOpts } = require("../utils/tx");

const deployName = "009_trillest_fix";

const fixTRILLEST = async () => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  // Temporary TRILLEST for running a reset
  const dTRILLESTReset = await deployWithConfirmation("TRILLESTReset");
  // Main TRILLEST
  const dTRILLEST = await deployWithConfirmation("TRILLEST");

  const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");
  const cTRILLESTReset = await ethers.getContractAt(
    "TRILLESTReset",
    cTRILLESTProxy.address
  );
  const cVaultProxy = await ethers.getContract("VaultProxy");

  // Proposal for the new governor to:
  // - upgradeTo TRILLESTReset
  // - call reset()
  // - upgradeTo TRILLEST
  const propResetDescription = "TRILLEST Reset";
  const propResetArgs = await proposeArgs([
    {
      contract: cTRILLESTProxy,
      signature: "upgradeTo(address)",
      args: [dTRILLESTReset.address],
    },
    {
      contract: cTRILLESTReset,
      signature: "reset()",
    },
    {
      contract: cTRILLESTReset,
      signature: "setVaultAddress(address)",
      args: [cVaultProxy.address],
    },
    {
      contract: cTRILLESTProxy,
      signature: "upgradeTo(address)",
      args: [dTRILLEST.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propResetArgs, propResetDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propResetArgs, propResetDescription);
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;
    await withConfirmation(
      cTRILLESTProxy
        .connect(sGovernor)
        .upgradeTo(dTRILLESTReset.address, await getTxOpts(gasLimit))
    );
    log("Upgraded TRILLEST to reset implementation");

    await withConfirmation(
      cTRILLESTReset
        .connect(sGovernor)
        .setVaultAddress(cVaultProxy.address, await getTxOpts(gasLimit))
    );
    log("Vault address set");

    await withConfirmation(
      cTRILLESTReset.connect(sGovernor).reset(await getTxOpts(gasLimit))
    );
    log("Called reset on TRILLEST");

    await withConfirmation(
      cTRILLESTProxy
        .connect(sGovernor)
        .upgradeTo(dTRILLEST.address, await getTxOpts(gasLimit))
    );
    log("Upgraded TRILLEST to standard implementation");
  }

  console.log(`${deployName} deploy done.`);
  return true;
};

const main = async () => {
  console.log(`Running ${deployName} deployment...`);
  await fixTRILLEST();
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["002_upgrade_vault", "003_governor", "008_trillest_reset"];
main.skip = () => !(isMainnet || isRinkeby) || isFork;

module.exports = main;
