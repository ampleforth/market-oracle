const Oracle = artifacts.require('Oracle.sol');
const DataProvider = artifacts.require('DataProvider.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle, provider, provider2, deployer, A, B, r;
function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  A = accounts[1];
  B = accounts[2];
  oracle = await Oracle.new();
  provider = await DataProvider.new('coin-market-cap', 3600, {from: A});
  provider2 = await DataProvider.new('crypto-compare', 3600, {from: B});
}

contract('Oracle:whitelistSize', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return the number of providers added to the whitelist', async function () {
    await oracle.addProvider(A);
    await oracle.addProvider(A);
    await oracle.addProvider(A);
    (await oracle.whitelistSize.call()).should.be.bignumber.eq(3);
  });
});

contract('Oracle:addProvider', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(0);
      r = await oracle.addProvider(provider.address);
    });

    it('should emit ProviderAdded message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogProviderAdded');
      expect(event.args.provider).to.eq(provider.address);
    });
    it('should add provider to the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(provider.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});

contract('Oracle:addProvider:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.addProvider(provider.address, { from: deployer }))
    ).to.be.false;
  });
  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.addProvider(provider.address, { from: A }))
    ).to.be.true;
  });
});

contract('Oracle:removeProvider', async function (accounts) {
  describe('when provider is part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeProvider(provider.address);
    });

    it('should emit ProviderRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogProviderRemoved');
      expect(event.args.provider).to.eq(provider.address);
    });
    it('should remove provider from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});

contract('Oracle:removeProvider', async function (accounts) {
  describe('when provider is NOT part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeProvider(A);
    });

    it('should NOT emit ProviderRemoved message', async function () {
      const logs = r.logs;
      expect(logs).to.be.empty;
    });
    it('should NOT remove provider any from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(provider.address);
      expect(await oracle.whitelist.call(1)).to.eq(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
    });
  });
});

contract('Oracle:removeProvider:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.removeProvider(provider.address, { from: deployer }))
    ).to.be.false;
  });
  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.removeProvider(provider.address, { from: A }))
    ).to.be.true;
  });
});

contract('Oracle:getAggregatedData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(provider.address);
    await oracle.addProvider(provider2.address);
    await provider.report(1053200000000000000, 2, nowSeconds(), { from: A });
    await provider2.report(1041000000000000000, 3, nowSeconds(), { from: B });
  });

  describe('when the providers are live', function () {
    it('should calculate the combined aggregated data', async function () {
      const resp = await oracle.getAggregatedData.call();
      resp.should.be.bignumber.eq(1045880000000000000);
    });
  });
});

contract('Oracle:getAggregatedData', async function (accounts) {
  describe('when one of providers has expired', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      await provider.report(1053200000000000000, 2, timestamp, { from: A });
      await provider2.report(1041000000000000000, 3, timestamp - 3600, { from: B });
    });

    it('should emit ProviderExpired message', async function () {
      const resp = await oracle.getAggregatedData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogProviderExpired');
      expect(event.args.provider).to.eq(provider2.address);
    });
    it('should calculate the aggregated data', async function () {
      const resp = await oracle.getAggregatedData.call();
      resp.should.be.bignumber.eq(1053200000000000000);
    });
  });
});

contract('Oracle:getAggregatedData', async function (accounts) {
  describe('when all providers have expired', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      await provider.report(1053200000000000000, 2, timestamp - 3600, { from: A });
      await provider2.report(1041000000000000000, 3, timestamp - 3600, { from: B });
    });

    it('should emit 2 ProviderExpired messages', async function () {
      const resp = await oracle.getAggregatedData();
      const logs = resp.logs;
      let event = logs[0];
      expect(event.event).to.eq('LogProviderExpired');
      expect(event.args.provider).to.eq(provider.address);

      event = logs[1];
      expect(event.event).to.eq('LogProviderExpired');
      expect(event.args.provider).to.eq(provider2.address);
    });
    it('should return 0', async function () {
      const resp = await oracle.getAggregatedData.call();
      resp.should.be.bignumber.eq(0);
    });
  });
});

contract('Oracle:getAggregatedData', async function (accounts) {
  describe('when one of providers is NOT live', function () {
    const timestamp = nowSeconds();
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      await provider.report(1053200000000000000, 2, timestamp, { from: A });
      await provider2.report(1041000000000000000, 3, timestamp, { from: B });
      await provider.destroy({ from: A });
    });

    it('should fail', async function () {
      expect(await chain.isEthException(oracle.getAggregatedData())).to.be.true;
    });
  });
});

contract('Oracle:removeDestructedProviders', async function (accounts) {
  describe('when one of providers is destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      await provider2.destroy({ from: B });
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeDestructedProviders();
    });

    it('should emit ProviderRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogProviderRemoved');
      expect(event.args.provider).to.eq(provider2.address);
    });

    it('should remove the dead provider from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(provider.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});

contract('Oracle:removeDestructedProviders', async function (accounts) {
  describe('when NONE of providers are destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeDestructedProviders();
    });

    it('should NOT emit ProviderRemoved message', async function () {
      const logs = r.logs;
      expect(logs).to.be.empty;
    });
    it('should NOT remove any provider from the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(provider.address);
      expect(await oracle.whitelist.call(1)).to.eq(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
    });
  });

  describe('when multiple providers are destructed', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      const provider3 = await DataProvider.new('OTHER_SOURCE', 3600, {from: A});
      await oracle.addProvider(provider3.address);
      await oracle.addProvider(provider.address);
      await oracle.addProvider(provider2.address);
      await provider.destroy({ from: A });
      await provider2.destroy({ from: B });
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(3);
      r = await oracle.removeDestructedProviders();
    });

    it('should emit multiple ProviderRemoved messages', async function () {
      const logs = r.logs;
      expect(logs[0].event).to.eq('LogProviderRemoved');
      expect(logs[0].args.provider).to.eq(provider.address);
      expect(logs[1].event).to.eq('LogProviderRemoved');
      expect(logs[1].args.provider).to.eq(provider2.address);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
  });
});
