const {
  isMainnet,
  isFork,
  isRinkeby,
  isSmokeTest,
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

const deployName = "012_upgrades";

/**
 * Deploys an upgrade for the following contracts:
 *  - TRILLEST
 *  - VaultAdmin
 *  - Compound Strategy
 * @returns {Promise<boolean>}
 */
const upgrades = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVaultCoreProxy = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );

  // Deploy a new TRILLEST contract.
  const dTRILLEST = await deployWithConfirmation("TRILLEST");

  // Deploy a new VaultAdmin contract.
  const dVaultAdmin = await deployWithConfirmation("VaultAdmin");

  // Deploy a new CompoundStrategy contract.
  const dCompoundStrategy = await deployWithConfirmation("CompoundStrategy");

  // Proposal for the governor to do the upgrades.
  const propDescription = "TRILLEST, VaultAdmin, CompoundStrategy upgrades";
  const propArgs = await proposeArgs([
    {
      contract: cTRILLESTProxy,
      signature: "upgradeTo(address)",
      args: [dTRILLEST.address],
    },
    {
      contract: cVaultCoreProxy,
      signature: "setAdminImpl(address)",
      args: [dVaultAdmin.address],
    },
    {
      contract: cCompoundStrategyProxy,
      signature: "upgradeTo(address)",
      args: [dCompoundStrategy.address],
    },
  ]);

  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription);
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;

    await withConfirmation(
      cTRILLESTProxy
        .connect(sGovernor)
        .upgradeTo(dTRILLEST.address, await getTxOpts(gasLimit))
    );
    log("Upgraded TRILLEST to new implementation");

    await withConfirmation(
      cVaultCoreProxy
        .connect(sGovernor)
        .setAdminImpl(dVaultAdmin.address, await getTxOpts(gasLimit))
    );
    log("Upgraded VaultAdmin to new implementation");

    await withConfirmation(
      cCompoundStrategyProxy
        .connect(sGovernor)
        .upgradeTo(dCompoundStrategy.address, await getTxOpts(gasLimit))
    );
    log("Upgraded CompoundStrategy to new implementation");
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await upgrades(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["011_trillest_fix"];
main.skip = () => !(isMainnet || isRinkeby) || isSmokeTest || isFork;

module.exports = main;
