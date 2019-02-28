const MarketOracle = artifacts.require('MarketOracle.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle, source, source2, deployer, A, B, r;
function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  A = accounts[1];
  B = accounts[2];
  oracle = await MarketOracle.new();
  source = await MarketSource.new('GDAX', 3600, {from: A});
  source2 = await MarketSource.new('Binance', 3600, {from: B});
}

contract('MarketOracle:whitelistSize', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return the number of sources added to the whitelist', async function () {
    await oracle.addSource(A);
    await oracle.addSource(A);
    await oracle.addSource(A);
    (await oracle.whitelistSize.call()).should.be.bignumber.eq(3);
  });
});

contract('MarketOracle:addSource', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(0);
      r = await oracle.addSource(source.address);
    });

    it('should emit SourceAdded message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceAdded');
      expect(event.args.source).to.eq(source.address);
    });
    it('should add source to the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
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
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeSource(source.address);
    });

    it('should emit SourceRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(source.address);
    });
    it('should remove source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  describe('when source is NOT part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeSource(A);
    });

    it('should NOT emit SourceRemoved message', async function () {
      const logs = r.logs;
      expect(logs).to.be.empty;
    });
    it('should NOT remove source any from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect(await oracle.whitelist.call(1)).to.eq(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
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

contract('MarketOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
    await source.reportRate(1053200000000000000, 2, nowSeconds(), { from: A });
    await source2.reportRate(1041000000000000000, 3, nowSeconds(), { from: B });
  });

  describe('when the sources are live', function () {
    it('should calculate the combined market rate and volume', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1045880000000000000);
    });
  });
});

contract('MarketOracle:getData', async function (accounts) {
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
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(source2.address);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1053200000000000000);
    });
  });
});

contract('MarketOracle:getData', async function (accounts) {
  describe('when all sources have expired', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source.reportRate(1053200000000000000, 2, timestamp - 3600, { from: A });
      await source2.reportRate(1041000000000000000, 3, timestamp - 3600, { from: B });
    });

    it('should emit 2 SourceExpired messages', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      let event = logs[0];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(source.address);

      event = logs[1];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(source2.address);
    });
    it('should return false and 0', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
      resp[0].should.be.bignumber.eq(0);
    });
  });
});

contract('MarketOracle:getData', async function (accounts) {
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
      expect(await chain.isEthException(oracle.getData())).to.be.true;
    });
  });
});

contract('MarketOracle:removeDestructedSources', async function (accounts) {
  describe('when one of sources is destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source2.destroy({ from: B });
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeDestructedSources();
    });

    it('should emit SourceRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(source2.address);
    });

    it('should remove the dead source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});

contract('MarketOracle:removeDestructedSources', async function (accounts) {
  describe('when NONE of sources are destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeDestructedSources();
    });

    it('should NOT emit SourceRemoved message', async function () {
      const logs = r.logs;
      expect(logs).to.be.empty;
    });
    it('should NOT remove any source from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
      expect(await oracle.whitelist.call(1)).to.eq(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
    });
  });

  describe('when multiple sources are destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      const source3 = await MarketSource.new('OTHER_SOURCE', 3600, {from: A});
      await oracle.addSource(source3.address);
      await oracle.addSource(source.address);
      await oracle.addSource(source2.address);
      await source.destroy({ from: A });
      await source2.destroy({ from: B });
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(3);
      r = await oracle.removeDestructedSources();
    });

    it('should emit SourceRemoved messages', async function () {
      const logs = r.logs;
      expect(logs[0].event).to.eq('LogSourceRemoved');
      expect(logs[0].args.source).to.eq(source.address);
      expect(logs[1].event).to.eq('LogSourceRemoved');
      expect(logs[1].args.source).to.eq(source2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});
