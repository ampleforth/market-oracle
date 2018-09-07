const MarketOracle = artifacts.require('MarketOracle.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

let oracle, source, source2, deployer, A, B, r;
function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  A = accounts[1];
  B = accounts[2];
  oracle = await MarketOracle.new();
  source = await MarketSource.new('GDAX', {from: A});
  source2 = await MarketSource.new('Binance', {from: B});
}

contract('MarketOracle:whitelistCount', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return the number of sources added to the whitelist', async function () {
    await oracle.addSource(A);
    await oracle.addSource(A);
    await oracle.addSource(A);
    expect((await oracle.whitelistCount.call()).toNumber()).to.eq(3);
  });
});

contract('MarketOracle:addSource', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(0);
      r = await oracle.addSource(source.address);
    });

    it('should emit SourceAdded message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceAdded');
      expect(event.args.source).to.eq(source.address);
    });
    it('should add source to the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(1);
    });
  });
});

contract('MarketOracle:addSource:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.addSource(source.address, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.addSource(source.address, { from: A }))
    ).to.be.true;
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  describe('when source is part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
      r = await oracle.removeSource(source.address);
    });

    it('should emit SourceRemoved message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(source.address);
    });
    it('should remove source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(1);
    });
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  describe('when source is NOT part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
      r = await oracle.removeSource(A);
    });

    it('should NOT emit SourceRemoved message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      expect(logs).to.be.empty;
    });
    it('should NOT remove source any from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect(await oracle.whitelist.call(1)).to.eq(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
    });
  });
});

contract('MarketOracle:removeSource:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.removeSource(source.address, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.removeSource(source.address, { from: A }))
    ).to.be.true;
  });
});

contract('MarketOracle:getPriceAndVolume', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
    await source.reportRate(1053200000000000000, 2, nowSeconds(), { from: A });
    await source2.reportRate(1041000000000000000, 3, nowSeconds(), { from: B });
  });

  describe('when the sources are live', function () {
    it('should calculate the combined market rate and volume', async function () {
      const resp = await oracle.getPriceAndVolume.call();
      expect(resp[0].toNumber()).to.eq(1045880000000000000);
      expect(resp[1].toNumber()).to.eq(5);
    });
  });
});

contract('MarketOracle:getPriceAndVolume', async function (accounts) {
  describe('when one of sources has expired', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source.reportRate(1053200000000000000, 2, timestamp, { from: A });
      await source2.reportRate(1041000000000000000, 3, timestamp - 3600, { from: B });
    });

    it('should emit SourceExpired message', async function () {
      const resp = await oracle.getPriceAndVolume();
      const logs = chain.decodeLogs(resp.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(source2.address);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getPriceAndVolume.call();
      expect(resp[0].toNumber()).to.eq(1053200000000000000);
      expect(resp[1].toNumber()).to.eq(2);
    });
  });
});

contract('MarketOracle:getPriceAndVolume', async function (accounts) {
  describe('when one of sources is NOT live', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source.reportRate(1053200000000000000, 2, timestamp, { from: A });
      await source2.reportRate(1041000000000000000, 3, timestamp, { from: B });
      await source.destroy({ from: A });
    });

    it('should fail', async function () {
      expect(await chain.isEthException(oracle.getPriceAndVolume())).to.be.true;
    });
  });
});

contract('MarketOracle:removeDeadSources', async function (accounts) {
  describe('when one of sources is DEAD', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source2.destroy({ from: B });
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
      r = await oracle.removeDeadSources();
    });

    it('should emit SourceRemoved message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(source2.address);
    });

    it('should remove the dead source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(1);
    });
  });
});

contract('MarketOracle:removeDeadSources', async function (accounts) {
  describe('when NONE of sources are dead', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
      r = await oracle.removeDeadSources();
    });

    it('should NOT emit SourceRemoved message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      expect(logs).to.be.empty;
    });
    it('should NOT remove any source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect(await oracle.whitelist.call(1)).to.eq(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(2);
    });
  });

  describe('when multiple sources are dead', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      const source3 = await MarketSource.new('OTHER_SOURCE', {from: A});
      await oracle.addSource(source3.address);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source.destroy({ from: A });
      await source2.destroy({ from: B });
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(3);
      r = await oracle.removeDeadSources();
    });

    it('should emit SourceRemoved messages', async function () {
      const logs = r.logs;
      expect(logs[0].event).to.eq('LogSourceRemoved');
      expect(logs[0].args.source).to.eq(source.address);
      expect(logs[1].event).to.eq('LogSourceRemoved');
      expect(logs[1].args.source).to.eq(source2.address);
      expect((await oracle.whitelistCount.call()).toNumber()).to.eq(1);
    });
  });
});
