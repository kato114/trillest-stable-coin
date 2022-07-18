const { deploymentWithProposal } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "025_resolution_upgrade_start", forceDeploy: false },
  async ({ ethers, deployWithConfirmation }) => {
    const dTRILLESTImpl = await deployWithConfirmation(
      "TRILLEST",
      undefined,
      undefined,
      true
    );
    const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");

    // Governance proposal
    return {
      name: "Activate TRILLEST after resolution upgrade complete",
      actions: [
        {
          contract: cTRILLESTProxy,
          signature: "upgradeTo(address)",
          args: [dTRILLESTImpl.address],
        },
      ],
    };
  }
);
