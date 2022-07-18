const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "019_resolution_and_savings" },
  async ({ ethers, deployWithConfirmation }) => {
    // Deployments
    const dTRILLEST = await deployWithConfirmation("TRILLEST");
    const dVaultCore = await deployWithConfirmation("VaultCore");

    // Governance proposal
    const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");
    const cVaultProxy = await ethers.getContract("VaultProxy");
    return {
      name: "Upgrade TRILLEST resolution for new contracts, redeem gas savings",
      actions: [
        {
          contract: cTRILLESTProxy,
          signature: "upgradeTo(address)",
          args: [dTRILLEST.address],
        },
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
      ],
    };
  }
);
