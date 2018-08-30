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
    source = await MarketSource.new('GDAX', { from: A });
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
            source.reportRate(0, 300, nowSeconds(), { from: deployer })
          )).to.be.true;
        });
      });

      describe('when reported volume is 0', function () {
        it('should revert', async function () {
          expect(await chain.isEthException(
            source.reportRate(1050000000000000000, 0, nowSeconds(), { from: deployer })
          )).to.be.true;
        });
      });

      describe('when the exchange rate and volume are valid', function () {
        let r;
        const timestamp = nowSeconds() + 3600;
        before(async function () {
          r = await source.reportRate(1050000000000000000, 3, timestamp, { from: A });
        });
        it('should update the report', async function () {
          expect((await source.getExchangeRate.call()).toNumber()).to.eq(1050000000000000000);
          expect((await source.getVolume24hrs.call()).toNumber()).to.eq(3);
        });
        it('should emit ExchangeRateReported', async function () {
          const reportEvent = r.logs[0];
          expect(reportEvent.event).to.eq('ExchangeRateReported');
          expect(reportEvent.args.exchangeRate.toNumber()).to.eq(1050000000000000000);
          expect(reportEvent.args.volume24hrs.toNumber()).to.eq(3);
          expect(reportEvent.args.posixTimestamp.toNumber()).to.eq(timestamp);
        });
      });
    });

    describe('when NOT reported by the owner', function () {
      it('should fail', async function () {
        expect(await chain.isEthException(
          source.reportRate(1050000000000000000, 3, nowSeconds(), { from: deployer })
        )).to.be.true;
      });
    });
  });

  describe('isActive', function () {
    const timestamp = nowSeconds();
    describe('when the most recent report has NOT expired', function () {
      it('should return true', async function () {
        await source.reportRate(1000000000000000000, 1, timestamp, { from: A });
        expect(await source.isActive.call()).to.be.true;
      });
    });

    describe('when the most recent report has expired', function () {
      it('should return false', async function () {
        await source.reportRate(1000000000000000000, 1, timestamp - 3600, { from: A });
        expect(await source.isActive.call()).to.be.false;
      });
    });
  });
});
