const PriceFeed = artifacts.require('PriceFeed.sol');
const Medianizer = artifacts.require('Medianizer.sol');
const MarketOracle = artifacts.require('MarketOracle.sol');

let oracle, f1, f2, f3, exSource, cpiSource;
function timeNowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  f1 = await PriceFeed.new();
  f2 = await PriceFeed.new();
  f3 = await PriceFeed.new();
  exSource = await Medianizer.new();
  cpiSource = await Medianizer.new();
  await exSource.set(f1.address);
  await exSource.set(f2.address);
  await cpiSource.set(f3.address);
  oracle = await MarketOracle.new(exSource.address, cpiSource.address, 100e18);
}

contract('MarketOracle:getInflationAdjustedPrice', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return inflation adjusted price', async function () {
    const validTill = timeNowSeconds() + 3600;
    await f1.post(1.5e18, validTill, exSource.address);
    await f2.post(1.45e18, validTill, exSource.address);
    await f3.post(211e18, validTill, exSource.address);

    const exRateRes = await exSource.compute.call();
    expect(parseInt(exRateRes[0], 16)).to.eq(1.475e18);
    expect(exRateRes[1]).to.be.true;

    const cpiRes = await cpiSource.compute.call();
    expect(parseInt(cpiRes[0], 16)).to.eq(211e18);
    expect(cpiRes[1]).to.be.true;

    expect((await oracle.getInflationAdjustedPrice.call()).toString()).to.eq('699052132701421800');
  });
});
