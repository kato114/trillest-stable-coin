const { deploymentWithProposal, withConfirmation } = require("../utils/deploy");

module.exports = deploymentWithProposal(
  { deployName: "039_wrapped_trillest", forceDeploy: false },
  async ({ deployWithConfirmation, getTxOpts, ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Current contracts
    const cTRILLESTProxy = await ethers.getContract("TRILLESTProxy");

    // Deployer Actions
    // ----------------

    // 1. Deploy the new implementation.
    const dWrappedTrillestImpl = await deployWithConfirmation(
      "WrappedTrillest",
      [cTRILLESTProxy.address, "Wrapped TRILLEST", "WTRILLEST"]
    );

    // 2. Deploy the new proxy
    const dWrappedTRILLESTProxy = await deployWithConfirmation(
      "WrappedTRILLESTProxy"
    );
    const cWrappedTRILLESTProxy = await ethers.getContract(
      "WrappedTRILLESTProxy"
    );
    const cWrappedTRILLEST = await ethers.getContractAt(
      "WrappedTrillest",
      cWrappedTRILLESTProxy.address
    );

    // 3. Configure Proxy
    await withConfirmation(
      cWrappedTRILLESTProxy
        .connect(sDeployer)
        ["initialize(address,address,bytes)"](
          dWrappedTrillestImpl.address,
          deployerAddr,
          [],
          await getTxOpts()
        )
    );

    // 3. Initialize Wrapped TRILLEST
    await withConfirmation(
      cWrappedTRILLEST.connect(sDeployer)["initialize()"](await getTxOpts())
    );

    // 4. Assign ownership
    await withConfirmation(
      cWrappedTRILLEST
        .connect(sDeployer)
        .transferGovernance(governorAddr, await getTxOpts())
    );

    // Governance Actions
    // ----------------

    return {
      name: "Claim WTRILLEST Governance",
      actions: [
        // 1. Claim governance
        {
          contract: cWrappedTRILLEST,
          signature: "claimGovernance()",
        },
      ],
    };
  }
);
