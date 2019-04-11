// TODO(naguib): Fail tests if gas utilization changes
const MarketOracle = artifacts.require('MarketOracle.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle, source, source2, deployer, r;
let accounts;
function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  oracle = await MarketOracle.new();
  oracle.setReportExpirationTimeSec(3600);
}

// TODO(naguib): Fail if gas utilization changes.
contract('MarketOracle:GasTests', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    const count = 10;
    list = Array.from({length: count}, () => Math.floor(Math.random() * 10 ** 18));

    for (let i = 0; i < count; i++) {
      r = await oracle.addSource(accounts[i + 1], { from: accounts[0] });
      r = await oracle.pushReport(list[i], { from: accounts[i + 1] });
      console.log('Initial pushReport() gas:', r.receipt.gasUsed);
    }

    for (let i = 0; i < count; i++) {
      r = await oracle.pushReport(list[i] + 1, { from: accounts[i + 1] });
      console.log('Update pushReport() gas:', r.receipt.gasUsed);
    }
  });

  describe('when the sources are live', function () {
    it('should calculate the combined market rate and volume', async function () {
      r = await oracle.getData();
      console.log('getData() gas:', r.receipt.gasUsed);
    });
  });
});
