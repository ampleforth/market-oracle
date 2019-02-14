const PriceFeed = artifacts.require('PriceFeed.sol');
const Medianizer = artifacts.require('Medianizer.sol');

function timeNowSeconds () {
  return parseInt(Date.now() / 1000);
}
contract('Medianizer', async function (accounts) {
  it('should return the median price feed', async function () {
    const m1 = await Medianizer.new();
    const p1 = await PriceFeed.new();
    const p2 = await PriceFeed.new();
    const p3 = await PriceFeed.new();

    await m1.set(p1.address);
    await m1.set(p2.address);
    await m1.set(p3.address);

    await p1.post(1.5e18, timeNowSeconds() + 3600, m1.address);
    await p2.post(0.9e18, timeNowSeconds() + 3600, m1.address);
    await p3.post(1.2e18, timeNowSeconds() + 3600, m1.address);

    const res = await m1.compute.call();
    expect(parseInt(res[0], 16)).to.eq(1.2e18);
    expect(res[1]).to.be.true;
  });
});
