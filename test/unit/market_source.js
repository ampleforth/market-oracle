const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BigNumber = web3.BigNumber;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);


require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

const RATE_1 = new BigNumber('1').mul(10 ** 18);
const RATE_1_05 = new BigNumber('1.05').mul(10 ** 18);
const VOLUME = new BigNumber('100000.912').mul(10 ** 18)

let source, A, B;
function timeNowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAddresses (accounts) {
  A = accounts[1];
  B = accounts[0];
  source = await MarketSource.new('GDAX', 600, { from: A });
}

contract('MarketSource:initialization', async function (accounts) {
  before(async function () {
    await setupContractsAndAddresses(accounts);
  });

  it('should set the name', async function () {
    expect(await source._name.call()).to.eq('GDAX');
  });

  it('should set the expiration time', async function () {
    (await source._reportExpirationTimeSec.call()).should.be.bignumber.eq(600);
  });
});

contract('MarketSource:reportRate', async function (accounts) {
  before(async function () {
    await setupContractsAndAddresses(accounts);
  });

  describe('when reported exchangeRate is 0', function () {
    it('should revert', async function () {
      expect(await chain.isEthException(
        source.reportRate(0, VOLUME, await timeNowSeconds(), { from: A })
      )).to.be.true;
    });
  });

  describe('when reported volume is 0', function () {
    it('should revert', async function () {
      expect(await chain.isEthException(
        source.reportRate(RATE_1_05, 0, await timeNowSeconds(), { from: A })
      )).to.be.true;
    });
  });

  describe('when the exchange rate and volume are valid', function () {
    let r;
    let timestamp;
    before(async function () {
      timestamp = await timeNowSeconds();
      r = await source.reportRate(RATE_1_05, VOLUME, timestamp, { from: A });
    });
    it('should update the report', async function () {
      const report = await source.getReport.call();
      expect(report[0]).to.be.true;
      report[1].should.be.bignumber.eq(RATE_1_05);
      report[2].should.be.bignumber.eq(VOLUME);
    });
    it('should emit ExchangeRateReported', async function () {
      const reportEvent = r.logs[0];
      expect(reportEvent.event).to.eq('LogExchangeRateReported');
      reportEvent.args.exchangeRate.should.be.bignumber.eq(RATE_1_05);
      reportEvent.args.volume24hrs.should.be.bignumber.eq(VOLUME);
      reportEvent.args.timestampSec.should.be.bignumber.eq(timestamp);
    });
  });

  describe('when NOT reported by the owner', function () {
    it('should fail', async function () {
      expect(await chain.isEthException(
        source.reportRate(RATE_1_05, VOLUME, await timeNowSeconds(), { from: B })
      )).to.be.true;
    });
  });
});

contract('MarketSource:isFresh', function (accounts) {
  before(async function () {
    await setupContractsAndAddresses(accounts);
  });

  describe('when the most recent report is Fresh', function () {
    it('should return true', async function () {
      await source.reportRate(RATE_1, VOLUME, await timeNowSeconds(), { from: A });
      const report = await source.getReport.call();
      expect(report[0]).to.be.true;
    });
  });

  describe('when the most recent report is NOT Fresh', function () {
    it('should return false', async function () {
      await source.reportRate(RATE_1, VOLUME, (await timeNowSeconds() - 600), { from: A });
      const report = await source.getReport.call();
      expect(report[0]).to.be.false;
    });
  });
});
