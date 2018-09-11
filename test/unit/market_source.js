const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

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
    expect((await source._reportExpirationTimeSec.call()).toNumber()).to.eq(600);
  });
});

contract('MarketSource:reportRate', async function (accounts) {
  before(async function () {
    await setupContractsAndAddresses(accounts);
  });

  describe('when reported exchangeRate is 0', function () {
    it('should revert', async function () {
      expect(await chain.isEthException(
        source.reportRate(0, 300, await timeNowSeconds(), { from: A })
      )).to.be.true;
    });
  });

  describe('when reported volume is 0', function () {
    it('should revert', async function () {
      expect(await chain.isEthException(
        source.reportRate(1050000000000000000, 0, await timeNowSeconds(), { from: A })
      )).to.be.true;
    });
  });

  describe('when the exchange rate and volume are valid', function () {
    let r;
    const rate = 1050000000000000000;
    const volume = 103;
    let timestamp;
    before(async function () {
      timestamp = await timeNowSeconds();
      r = await source.reportRate(rate, volume, timestamp, { from: A });
    });
    it('should update the report', async function () {
      const report = await source.getReport.call();
      expect(report[0]).to.be.true;
      expect(report[1].toNumber()).to.eq(rate);
      expect(report[2].toNumber()).to.eq(volume);
    });
    it('should emit ExchangeRateReported', async function () {
      const reportEvent = r.logs[0];
      expect(reportEvent.event).to.eq('LogExchangeRateReported');
      expect(reportEvent.args.exchangeRate.toNumber()).to.eq(rate);
      expect(reportEvent.args.volume24hrs.toNumber()).to.eq(volume);
      expect(reportEvent.args.timestampSecs.toNumber()).to.eq(timestamp);
    });
  });

  describe('when NOT reported by the owner', function () {
    it('should fail', async function () {
      expect(await chain.isEthException(
        source.reportRate(1050000000000000000, 103, await timeNowSeconds(), { from: B })
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
      await source.reportRate(1000000000000000000, 1, await timeNowSeconds(), { from: A });
      const report = await source.getReport.call();
      expect(report[0]).to.be.true;
    });
  });

  describe('when the most recent report is NOT Fresh', function () {
    it('should return false', async function () {
      await source.reportRate(1000000000000000000, 1, (await timeNowSeconds() - 600), { from: A });
      const report = await source.getReport.call();
      expect(report[0]).to.be.false;
    });
  });
});
