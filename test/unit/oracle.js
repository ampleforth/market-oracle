const Oracle = artifacts.require('Oracle.sol');
const DataFeeder = artifacts.require('DataFeeder.sol');

function timeNowSeconds () {
  return parseInt(Date.now() / 1000);
}

contract('Oracle#getMedianReport', async function (accounts) {
  it('should return the median report', async function () {
    const f1 = await DataFeeder.new(3600);
    const f2 = await DataFeeder.new(3600);
    const f3 = await DataFeeder.new(3600);

    await f1.feed(1.5e18);
    await f2.feed(0.9e18);
    await f3.feed(1.2e18);

    const oracle = await Oracle.new();
    await oracle.addDataFeeder(f1.address);
    await oracle.addDataFeeder(f2.address);
    await oracle.addDataFeeder(f3.address);

    const res = await oracle.getMedianReport.call();
    expect(res.toNumber()).to.eq(1.2e18);
  });
});
