// Displays an account TRILLEST balance and credits.
async function balance(taskArguments) {
  const trillestProxy = await ethers.getContract("TRILLESTProxy");
  const trillest = await ethers.getContractAt(
    "TRILLEST",
    trillestProxy.address
  );

  const balance = await trillest.balanceOf(taskArguments.account);
  const credits = await trillest.creditsBalanceOf(taskArguments.account);
  console.log(
    "TRILLEST balance=",
    ethers.utils.formatUnits(balance.toString(), 18)
  );
  console.log(
    "TRILLEST credits=",
    ethers.utils.formatUnits(credits[0].toString(), 18)
  );
  console.log(
    "TRILLEST creditsPerToken=",
    ethers.utils.formatUnits(credits[1].toString(), 18)
  );
}

module.exports = {
  balance,
};
