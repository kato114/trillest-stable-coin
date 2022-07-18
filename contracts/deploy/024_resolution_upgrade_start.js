const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "024_resolution_upgrade_start", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    const dTRILLESTResolutionUpgrade = await deployWithConfirmation(
      "TRILLESTResolutionUpgrade"
    );
    const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");

    // Deployments
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVaultAdmin = await ethers.getContractAt(
      "VaultAdmin",
      cVaultProxy.address
    );

    // Governance proposal
    return {
      name: "Switch TRILLEST into resolution upgrade mode",
      actions: [
        {
          contract: cTRILLESTProxy,
          signature: "upgradeTo(address)",
          args: [dTRILLESTResolutionUpgrade.address],
        },
        {
          contract: cVaultAdmin,
          signature: "pauseCapital()",
          args: [],
        },
      ],
    };
  }
);
