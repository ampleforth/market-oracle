const ExchangeRateAggregator = artifacts.require('ExchangeRateAggregator.sol');
const ExchangeRateFactory = artifacts.require('ExchangeRateFactory.sol');
const ExchangeRateSource = artifacts.require('ExchangeRateSource.sol');

const _require = require('app-root-path').require;
const { ContractEventSpy } = _require('/util/spies');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('ExchangeRateAggregator', async accounts => {
  let factory, aggregator, s1, s2, r;
  const A = accounts[1];
  const B = accounts[2];

  before(async function () {
    factory = await ExchangeRateFactory.deployed();
    aggregator = await ExchangeRateAggregator.deployed();
    r = await factory.createSource('GDAX', {from: A});
    s1 = ExchangeRateSource.at(r.logs[0].args.source);
    r = await factory.createSource('Binance', {from: B});
    s2 = ExchangeRateSource.at(r.logs[0].args.source);
  });

  describe('addSource', () => {
    describe('when successful', () => {
      let sourceAddSpy, snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        sourceAddSpy = new ContractEventSpy([
          aggregator.SourceAdded
        ]);
        sourceAddSpy.watch();
        await aggregator.addSource(s1.address);
      });
      after(async () => {
        sourceAddSpy.stopWatching();
        await chain.revertToSnapshot(snapshot);
      });

      it('should emit SourceAdded message', async () => {
        const addedEvent = sourceAddSpy.getEventByName('SourceAdded');
        expect(addedEvent).to.exist;
        expect(addedEvent.args.source).to.eq(s1.address);
      });
      it('should add s1 to the whitelist', async () => {
        expect(await aggregator.whitelist.call(0)).to.eq(s1.address);
      });
    });

    describe('when more than MAX_SOURCES are added', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        for (let i = 0; i < 254; i++) {
          await aggregator.addSource(s1.address);
        }
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should fail', async () => {
        await aggregator.addSource(s1.address);
        await chain.expectEthException(
          aggregator.addSource(s1.address)
        );
      });
    });
  });

  describe('removeSource', () => {
    let sourceDelSpy, snapshot;
    before(async () => {
      snapshot = await chain.snapshotChain();
      await aggregator.addSource(s1.address);
      await aggregator.addSource(s2.address);
      sourceDelSpy = new ContractEventSpy([
        aggregator.SourceRemoved
      ]);
      sourceDelSpy.watch();
      await aggregator.removeSource(s1.address);
    });
    after(async () => {
      sourceDelSpy.stopWatching();
      await chain.revertToSnapshot(snapshot);
    });

    it('should emit SourceRemoved message', async () => {
      const removedEvent = sourceDelSpy.getEventByName('SourceRemoved');
      expect(removedEvent).to.exist;
      expect(removedEvent.args.source).to.eq(s1.address);
    });
    it('should remove source from the whitelist', async () => {
      expect(await aggregator.whitelist.call(0)).to.eq(s2.address);
    });
  });

  describe('aggregate', () => {
    describe('when the sources are live', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await aggregator.addSource(s1.address);
        await aggregator.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should calculate the aggregated rate and volume', async () => {
        const r = await aggregator.aggregate.call();
        expect(r[0].toNumber()).to.eq(1045880000000000000);
        expect(r[1].toNumber()).to.eq(5);
      });
    });

    describe('when one of sources has expired', () => {
      let snapshot, aggregatorSpy;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await aggregator.addSource(s1.address);
        await aggregator.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await chain.waitForSomeTime(3600);
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        aggregatorSpy = new ContractEventSpy([
          aggregator.SourceExpired
        ]);
        aggregatorSpy.watch();
        await aggregator.aggregate.sendTransaction();
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should emit SourceExpired message', async () => {
        const expiredEvent = aggregatorSpy.getEventByName('SourceExpired');
        expect(expiredEvent).to.exist;
        expect(expiredEvent.args.source).to.eq(s2.address);
      });
      it('should calculate the exchange rate', async () => {
        const r = await aggregator.aggregate.call();
        expect(r[0].toNumber()).to.eq(1053200000000000000);
        expect(r[1].toNumber()).to.eq(2);
      });
    });

    describe('when one of sources is NOT live', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await aggregator.addSource(s1.address);
        await aggregator.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await s1.destroy({ from: A, gas: gasLimit });
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should fail', async () => {
        await chain.expectEthException(aggregator.aggregate());
      });
    });
  });

  describe('removeDeadSources', () => {
    describe('when one of sources is NOT live', () => {
      let snapshot, aggregatorSpy;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await aggregator.addSource(s1.address);
        await aggregator.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await s1.destroy({ from: A, gas: gasLimit });
        aggregatorSpy = new ContractEventSpy([
          aggregator.SourceRemoved
        ]);
        aggregatorSpy.watch();
        await aggregator.removeDeadSources();
      });
      after(async () => {
        aggregatorSpy.stopWatching();
        await chain.revertToSnapshot(snapshot);
      });

      it('should emit SourceRemoved message', async () => {
        const deadEvent = aggregatorSpy.getEventByName('SourceRemoved');
        expect(deadEvent).to.exist;
        expect(deadEvent.args.source).to.eq(s1.address);
      });
      it('should remove that source from whitelist', async () => {
        expect(await aggregator.whitelist.call(0)).to.eq(s2.address);
      });
    });
  });
});
