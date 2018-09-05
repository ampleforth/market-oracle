const MarketOracle = artifacts.require('MarketOracle.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

let oracle, source, source2, A, B, r;
function nowSeconds () {
  return parseInt(Date.now() / 1000);
}

async function setupContractsAndAccounts (accounts) {
  A = accounts[1];
  B = accounts[2];
  oracle = await MarketOracle.new();
  source = await MarketSource.new('GDAX', {from: A});
  source2 = await MarketSource.new('Binance', {from: B});
}

contract('MarketOracle:addSource', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    r = await oracle.addSource(source.address);
  });

  describe('when successful', function () {
    it('should emit SourceAdded message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceAdded');
      expect(event.args.source).to.eq(source.address);
    });
    it('should add source to the whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source.address);
    });
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
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
  const timestamp = nowSeconds();
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
    await source.reportRate(1053200000000000000, 2, timestamp, { from: A });
    await source2.reportRate(1041000000000000000, 3, timestamp - 3600, { from: B });
  });

  describe('when one of sources has expired', function () {
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
  const timestamp = nowSeconds();
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
    await source.reportRate(1053200000000000000, 2, timestamp, { from: A });
    await source2.reportRate(1041000000000000000, 3, timestamp, { from: B });
    await source.destroy({ from: A });
  });

  describe('when one of sources is NOT live', function () {
    it('should fail', async function () {
      expect(await chain.isEthException(oracle.getPriceAndVolume())).to.be.true;
    });
  });
});

contract('MarketOracle:removeDeadSources', async function (accounts) {
  const timestamp = nowSeconds();
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(source.address);
    await oracle.addSource(source2.address);
    await source.reportRate(1053200000000000000, 2, timestamp, { from: A });
    await source2.reportRate(1041000000000000000, 3, timestamp, { from: B });
    await source.destroy({ from: A });
    r = await oracle.removeDeadSources();
  });

  describe('when one of sources is NOT live', function () {
    it('should emit SourceRemoved message', async function () {
      const logs = chain.decodeLogs(r.receipt.logs, MarketOracle, oracle.address);
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(source.address);
    });
    it('should remove that source from whitelist', async function () {
      expect(await oracle.whitelist.call(0)).to.eq(source2.address);
    });
  });
});
