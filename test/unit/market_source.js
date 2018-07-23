const MarketSourceFactory = artifacts.require('MarketSourceFactory.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('MarketSource', async accounts => {
  let factory, source;
  const deployer = accounts[0];
  const A = accounts[1];
  const gasLimit = await chain.getBlockGasLimit();

  before(async function () {
    factory = await MarketSourceFactory.deployed();
    const r = await factory.createSource('GDAX', { from: A });
    source = MarketSource.at(r.logs[0].args.source);
  });

  describe('initialization', () => {
    it('should set the name', async () => {
      expect(await source.name()).to.eq('GDAX');
    });
  });

  describe('reportRate', () => {
    describe('when reported by the owner', () => {
      describe('when reported exchangeRate is 0', () => {
        it('should revert', async () => {
          await chain.expectEthException(
            source.reportRate(0, 300, { from: deployer, gas: gasLimit })
          );
        });
      });

      describe('when reported volume is 0', () => {
        it('should revert', async () => {
          await chain.expectEthException(
            source.reportRate(1050000000000000000, 0, { from: deployer, gas: gasLimit })
          );
        });
      });

      describe('when the exchange rate and volume are valid', () => {
        let r;
        before(async () => {
          r = await source.reportRate(1050000000000000000, 3, { from: A, gas: gasLimit });
        });
        it('should update the report', async () => {
          expect((await source.exchangeRate.call()).toNumber()).to.eq(1050000000000000000);
          expect((await source.volume.call()).toNumber()).to.eq(3);
        });
        it('should emit ExchangeRateReported', async () => {
          const reportEvent = r.logs[0];
          expect(reportEvent.event).to.eq('ExchangeRateReported');
          expect(reportEvent.args.exchangeRate.toNumber()).to.eq(1050000000000000000);
          expect(reportEvent.args.volume24hrs.toNumber()).to.eq(3);
          expect(reportEvent.args.timestamp.toNumber()).to.exist;
        });
      });
    });

    describe('when NOT reported by the owner', () => {
      it('should fail', async () => {
        await chain.expectEthException(
          source.reportRate(1050000000000000000, 3, { from: deployer, gas: gasLimit })
        );
      });
    });
  });

  describe('isActive', () => {
    describe('when the most recent report has NOT expired', () => {
      it('should return true', async () => {
        await source.reportRate(1000000000000000000, 1, { from: A, gas: gasLimit });
        expect(await source.isActive.call()).to.be.true;
      });
    });

    describe('when the most recent report has expired', () => {
      it('should return false', async () => {
        await source.reportRate(1000000000000000000, 1, { from: A, gas: gasLimit });
        await chain.waitForSomeTime(3600);
        expect(await source.isActive.call()).to.be.false;
      });
    });
  });
});
