const MarketOracle = artifacts.require('MarketOracle.sol');
const MarketSourceFactory = artifacts.require('MarketSourceFactory.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const { ContractEventSpy } = _require('/util/spies');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('MarketOracle', async accounts => {
  let factory, oracle, s1, s2, r;
  const A = accounts[1];
  const B = accounts[2];

  before(async function () {
    factory = await MarketSourceFactory.deployed();
    oracle = await MarketOracle.deployed();
    r = await factory.createSource('GDAX', {from: A});
    s1 = MarketSource.at(r.logs[0].args.source);
    r = await factory.createSource('Binance', {from: B});
    s2 = MarketSource.at(r.logs[0].args.source);
  });

  describe('addSource', () => {
    describe('when successful', () => {
      let sourceAddSpy, snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        sourceAddSpy = new ContractEventSpy([
          oracle.SourceAdded
        ]);
        sourceAddSpy.watch();
        await oracle.addSource(s1.address);
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
        expect(await oracle.whitelist.call(0)).to.eq(s1.address);
      });
    });

    describe('when more than MAX_SOURCES are added', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        for (let i = 0; i < 254; i++) {
          await oracle.addSource(s1.address);
        }
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should fail', async () => {
        await oracle.addSource(s1.address);
        await chain.expectEthException(
          oracle.addSource(s1.address)
        );
      });
    });
  });

  describe('removeSource', () => {
    let sourceDelSpy, snapshot;
    before(async () => {
      snapshot = await chain.snapshotChain();
      await oracle.addSource(s1.address);
      await oracle.addSource(s2.address);
      sourceDelSpy = new ContractEventSpy([
        oracle.SourceRemoved
      ]);
      sourceDelSpy.watch();
      await oracle.removeSource(s1.address);
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
      expect(await oracle.whitelist.call(0)).to.eq(s2.address);
    });
  });

  describe('getPriceAndVolume', () => {
    describe('when the sources are live', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await oracle.addSource(s1.address);
        await oracle.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should calculate the combined market rate and volume', async () => {
        const r = await oracle.getPriceAndVolume.call();
        expect(r[0].toNumber()).to.eq(1045880000000000000);
        expect(r[1].toNumber()).to.eq(5);
      });
    });

    describe('when one of sources has expired', () => {
      let snapshot, oracleSpy;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await oracle.addSource(s1.address);
        await oracle.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await chain.waitForSomeTime(3600);
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        oracleSpy = new ContractEventSpy([
          oracle.SourceExpired
        ]);
        oracleSpy.watch();
        await oracle.getPriceAndVolume.sendTransaction();
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should emit SourceExpired message', async () => {
        const expiredEvent = oracleSpy.getEventByName('SourceExpired');
        expect(expiredEvent).to.exist;
        expect(expiredEvent.args.source).to.eq(s2.address);
      });
      it('should calculate the exchange rate', async () => {
        const r = await oracle.getPriceAndVolume.call();
        expect(r[0].toNumber()).to.eq(1053200000000000000);
        expect(r[1].toNumber()).to.eq(2);
      });
    });

    describe('when one of sources is NOT live', () => {
      let snapshot;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await oracle.addSource(s1.address);
        await oracle.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await s1.destroy({ from: A, gas: gasLimit });
      });
      after(async () => {
        await chain.revertToSnapshot(snapshot);
      });

      it('should fail', async () => {
        await chain.expectEthException(oracle.getPriceAndVolume());
      });
    });
  });

  describe('removeDeadSources', () => {
    describe('when one of sources is NOT live', () => {
      let snapshot, oracleSpy;
      before(async () => {
        snapshot = await chain.snapshotChain();
        await oracle.addSource(s1.address);
        await oracle.addSource(s2.address);
        const gasLimit = await chain.getBlockGasLimit();
        await s1.reportRate(1053200000000000000, 2, { from: A, gas: gasLimit });
        await s2.reportRate(1041000000000000000, 3, { from: B, gas: gasLimit });
        await s1.destroy({ from: A, gas: gasLimit });
        oracleSpy = new ContractEventSpy([
          oracle.SourceRemoved
        ]);
        oracleSpy.watch();
        await oracle.removeDeadSources();
      });
      after(async () => {
        oracleSpy.stopWatching();
        await chain.revertToSnapshot(snapshot);
      });

      it('should emit SourceRemoved message', async () => {
        const deadEvent = oracleSpy.getEventByName('SourceRemoved');
        expect(deadEvent).to.exist;
        expect(deadEvent.args.source).to.eq(s1.address);
      });
      it('should remove that source from whitelist', async () => {
        expect(await oracle.whitelist.call(0)).to.eq(s2.address);
      });
    });
  });
});
