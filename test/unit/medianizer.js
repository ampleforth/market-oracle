const Oracle = artifacts.require('Oracle.sol');

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));

function sleep (timeSec) {
  return new Promise((resolve, reject) => setTimeout(resolve, timeSec * 1000));
}

contract('Oracle#getMedianReport', async function (accounts) {
  it('should return the median report', async function () {
    const oracle = await Oracle.new(5, 10);
    await oracle.whitelist(accounts[1]);
    await oracle.whitelist(accounts[2]);
    await oracle.whitelist(accounts[3]);
    await oracle.beginReportingCycle();

    await oracle.report(1.5e18, { from: accounts[1] });
    await oracle.report(0.9e18, { from: accounts[2] });
    await oracle.report(1.2e18, { from: accounts[3] });

    await sleep(5);
    const res = await oracle.getMedianReport.call();
    expect(res.toNumber()).to.eq(1.2e18);
  });
});
