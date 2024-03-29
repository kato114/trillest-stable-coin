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

const deployName = "011_trillest_fix";

const fixTRILLEST = async (hre) => {
  console.log(`Running ${deployName} deployment...`);

  const { governorAddr } = await hre.getNamedAccounts();

  // Signers
  const sGovernor = await ethers.provider.getSigner(governorAddr);

  const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");

  // Deploy new TRILLEST contract
  const dTRILLEST = await deployWithConfirmation("TRILLEST");

  // Proposal for the governor to upgrade TRILLEST.
  const propDescription = "TRILLEST fix";
  const propArgs = await proposeArgs([
    {
      contract: cTRILLESTProxy,
      signature: "upgradeTo(address)",
      args: [dTRILLEST.address],
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
  }

  return true;
};

const main = async (hre) => {
  console.log(`Running ${deployName} deployment...`);
  if (!hre) {
    hre = require("hardhat");
  }
  await fixTRILLEST(hre);
  console.log(`${deployName} deploy done.`);
  return true;
};

main.id = deployName;
main.dependencies = ["002_upgrade_vault", "003_governor", "008_trillest_reset"];
main.skip = () => !(isMainnet || isRinkeby) || isFork;

module.exports = main;
