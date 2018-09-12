const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

contract('MarketSource', async function (accounts) {
  let source;
  const deployer = accounts[0];
  const A = accounts[1];

  before(async function () {
    source = await MarketSource.new('GDAX', 600, { from: A });
  });

  describe('initialization', function () {
    it('should set the name', async function () {
      expect(await source.name()).to.eq('GDAX');
    });
  });

  describe('reportRate', function () {
    describe('when reported by the owner', function () {
      describe('when reported exchangeRate is 0', function () {
        it('should revert', async function () {
          expect(await chain.isEthException(
            source.reportRate(0, 300, nowSeconds(), { from: A })
          )).to.be.true;
        });
      });

      describe('when reported volume is 0', function () {
        it('should revert', async function () {
          expect(await chain.isEthException(
            source.reportRate(1050000000000000000, 0, nowSeconds(), { from: A })
          )).to.be.true;
        });
      });

      describe('when the exchange rate and volume are valid', function () {
        let r;
        const rate = 1050000000000000000;
        const volume = 103;
        const timestamp = nowSeconds() + 600;
        before(async function () {
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
    });

    describe('when NOT reported by the owner', function () {
      it('should fail', async function () {
        expect(await chain.isEthException(
          source.reportRate(1050000000000000000, 103, nowSeconds(), { from: deployer })
        )).to.be.true;
      });
    });
  });

  describe('isFresh', function () {
    const timestamp = nowSeconds();
    describe('when the most recent report has NOT expired', function () {
      it('should return true', async function () {
        await source.reportRate(1000000000000000000, 1, timestamp, { from: A });
        const report = await source.getReport.call();
        expect(report[0]).to.be.true;
      });
    });

    describe('when the most recent report has expired', function () {
      it('should return false', async function () {
        await source.reportRate(1000000000000000000, 1, timestamp - 600, { from: A });
        const report = await source.getReport.call();
        expect(report[0]).to.be.false;
      });
    });
  });
});
