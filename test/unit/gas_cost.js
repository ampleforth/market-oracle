// TODO(naguib): Fail tests if gas utilization changes
const MedianOracle = artifacts.require('MedianOracle');

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle;

async function setupContractsAndAccounts (accounts) {
  oracle = await MedianOracle.new();
  oracle.setReportExpirationTimeSec(3600);
}

// TODO(naguib): Fail if gas utilization changes.
contract('MedianOracle:GasTests', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    const count = 9;
    const list = Array.from({length: count}, () => Math.floor(Math.random() * 10 ** 18));

    for (let i = 0; i < count; i++) {
      await oracle.addProvider(accounts[i + 1], { from: accounts[0] });
      const r = await oracle.pushReport(list[i], { from: accounts[i + 1] });
      console.log('Initial pushReport() gas:', r.receipt.gasUsed);
    }

    for (let i = 0; i < count; i++) {
      const r = await oracle.pushReport(list[i] + 1, { from: accounts[i + 1] });
      console.log('Update pushReport() gas:', r.receipt.gasUsed);
    }
  });

  describe('when the sources are live', function () {
    it('should calculate the combined market rate and volume', async function () {
      const r = await oracle.getData();
      console.log('getData() gas:', r.receipt.gasUsed);
    });
  });
});
