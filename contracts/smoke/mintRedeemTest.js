const { fund, mint } = require("../tasks/account");
const {
  usdtUnits,
  trillestUnits,
  usdcUnits,
  daiUnits,
  trillestUnitsFormat,
  isWithinTolerance,
} = require("../test/helpers");
const addresses = require("../utils/addresses");
const erc20Abi = require("../test/abi/erc20.json");

let utils, BigNumber, usdt, dai, usdc, trillest, vault, signer, signer2;

async function fundAccount4(hre) {
  await fund(
    {
      num: 1,
      amount: "3000",
    },
    hre
  );
}

const getUsdtBalance = async () => {
  return await usdt.connect(signer).balanceOf(signer.address);
};

const getDaiBalance = async () => {
  return await dai.connect(signer).balanceOf(signer.address);
};

const getUsdcBalance = async () => {
  return await usdc.connect(signer).balanceOf(signer.address);
};

const getTrillestBalance = async (signer) => {
  return await trillest.connect(signer).balanceOf(signer.address);
};

const assertExpectedTrillest = (
  bigNumber,
  bigNumberExpected,
  tolerance = 0.03
) => {
  if (!isWithinTolerance(bigNumber, bigNumberExpected, 0.03)) {
    throw new Error(
      `Unexpected TRILLEST value. Expected ${trillestUnitsFormat(
        bigNumberExpected
      )} with the tolerance of ${tolerance}. Received: ${trillestUnitsFormat(
        bigNumber
      )}`
    );
  }
};

const assertExpectedStablecoins = (
  usdtBn,
  daiBn,
  usdcBn,
  unitsExpected,
  tolerance = 0.03
) => {
  // adjust decimals of all stablecoins to 18 so they are easier to compare
  const adjustedUsdt = usdtBn.mul(BigNumber.from("1000000000000"));
  const adjustedUsdc = usdcBn.mul(BigNumber.from("1000000000000"));
  const allStablecoins = adjustedUsdt.add(adjustedUsdc).add(daiBn);
  const stableCoinsExpected = utils.parseUnits(unitsExpected, 18);

  if (!isWithinTolerance(allStablecoins, stableCoinsExpected, 0.03)) {
    throw new Error(
      `Unexpected value. Expected to receive total stablecoin units ${trillestUnitsFormat(
        stableCoinsExpected
      )} with the tolerance of ${tolerance}. Received: ${trillestUnitsFormat(
        allStablecoins
      )}`
    );
  }
};

async function setup(hre) {
  utils = hre.ethers.utils;
  BigNumber = hre.ethers.BigNumber;
  trillest = await hre.ethers.getContractAt(
    "TRILLEST",
    addresses.mainnet.TRILLESTProxy
  );
  usdt = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.USDT);
  dai = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.DAI);
  usdc = await hre.ethers.getContractAt(erc20Abi, addresses.mainnet.USDC);
  const vaultProxy = await hre.ethers.getContract("VaultProxy");
  vault = await ethers.getContractAt("IVault", vaultProxy.address);
  signer = (await hre.ethers.getSigners())[4];
  signer2 = (await hre.ethers.getSigners())[5];

  await fundAccount4(hre);
}

async function beforeDeploy(hre) {
  // fund stablecoins to the 4th account in signers
  await setup(hre);

  const usdtBeforeMint = await getUsdtBalance();
  const trillestBeforeMint = await getTrillestBalance(signer);
  const usdtToMint = "1100";
  await mint(
    {
      num: 1,
      amount: usdtToMint,
    },
    hre
  );

  const usdtAfterMint = await getUsdtBalance();
  const trillestAfterMint = await getTrillestBalance(signer);

  const expectedUsdt = usdtBeforeMint.sub(usdtUnits(usdtToMint));
  if (!usdtAfterMint.eq(expectedUsdt)) {
    throw new Error(
      `Incorrect usdt value. Got ${usdtAfterMint.toString()} expected: ${expectedUsdt.toString()}`
    );
  }

  const expectedTrillest = trillestBeforeMint.add(trillestUnits(usdtToMint));
  assertExpectedTrillest(trillestAfterMint, expectedTrillest);

  return {
    trillestBeforeMint,
    trillestAfterMint,
  };
}

const testMint = async (hre, beforeDeployData) => {
  const trillestBeforeMint = await getTrillestBalance(signer);
  await mint(
    {
      num: 1,
      amount: "500",
    },
    hre
  );

  const trillestAfterMint = await getTrillestBalance(signer);

  if (!beforeDeployData.trillestAfterMint.eq(trillestBeforeMint)) {
    throw new Error(
      `Deploy changed the amount of trillest in user's account from ${trillestUnitsFormat(
        beforeDeployData.trillestAfterMint
      )} to ${trillestUnitsFormat(trillestBeforeMint)}`
    );
  }

  return trillestAfterMint;
};

const testRedeem = async (trillestAfterMint) => {
  const usdtBeforeRedeem = await getUsdtBalance();
  const daiBeforeRedeem = await getDaiBalance();
  const usdcBeforeRedeem = await getUsdcBalance();

  const unitsToRedeem = "800";
  const trillestToRedeem = trillestUnits(unitsToRedeem);
  await vault.connect(signer).redeem(trillestToRedeem, trillestUnits("770"));

  const trillestAfterRedeem = await getTrillestBalance(signer);
  const usdtAfterRedeem = await getUsdtBalance();
  const daiAfterRedeem = await getDaiBalance();
  const usdcAfterRedeem = await getUsdcBalance();

  const expectedTrillest = trillestAfterMint.sub(trillestToRedeem);
  assertExpectedTrillest(trillestAfterRedeem, expectedTrillest, 0.0);

  assertExpectedStablecoins(
    usdtAfterRedeem.sub(usdtBeforeRedeem),
    daiAfterRedeem.sub(daiBeforeRedeem),
    usdcAfterRedeem.sub(usdcBeforeRedeem),
    "800"
  );
};

const testTransfer = async () => {
  const trillestSenderBeforeSend = await getTrillestBalance(signer);
  const trillestReceiverBeforeSend = await getTrillestBalance(signer2);
  const trillestToTransfer = "245.5";

  await trillest
    .connect(signer)
    .transfer(signer2.address, trillestUnits(trillestToTransfer));

  const trillestSenderAfterSend = await getTrillestBalance(signer);
  const trillestReceiverAfterSend = await getTrillestBalance(signer2);

  assertExpectedTrillest(
    trillestSenderAfterSend,
    trillestSenderBeforeSend.sub(trillestUnits(trillestToTransfer)),
    0.0
  );
  assertExpectedTrillest(
    trillestReceiverAfterSend,
    trillestReceiverBeforeSend.add(trillestUnits(trillestToTransfer)),
    0.0
  );
};

async function afterDeploy(hre, beforeDeployData) {
  const trillestAfterMint = await testMint(hre, beforeDeployData);
  await testRedeem(trillestAfterMint);
  await testTransfer();
}

module.exports = {
  beforeDeploy,
  afterDeploy,
};
