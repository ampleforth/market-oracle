// TODO(naguib): Add gas usage checks
const MarketOracle = artifacts.require('MarketOracle.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle, source, source2, deployer, A, B, C, D, r;

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  A = accounts[1];
  B = accounts[2];
  C = accounts[3];
  D = accounts[4];
  oracle = await MarketOracle.new();
  oracle.setReportExpirationTimeSec(3600);
}

contract('MarketOracle:whitelistSize', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return the number of sources added to the whitelist', async function () {
    await oracle.addSource(A);
    await oracle.addSource(B);
    await oracle.addSource(C);
    (await oracle.whitelistSize.call()).should.be.bignumber.eq(3);
  });
});

contract('MarketOracle:addSource', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(0);
      r = await oracle.addSource(A);
    });

    it('should emit SourceAdded message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceAdded');
      expect(event.args.source).to.eq(A);
    });
    it('should add source to the whitelist', async function () {
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
    });
    it('shouldnot add an existing source to the whitelist', async function () {
      expect(
          await chain.isEthException(oracle.addSource(A, { from: deployer }))
      ).to.be.true;
    });
  });
});

contract('MarketOracle:pushReport', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
    });

    it('should not push to non-whitelisted source', async function () {
      expect(
          await chain.isEthException(oracle.pushReport(1000000000000000000, { from: A }))
      ).to.be.true;
      oracle.addSource(A, { from: deployer });
      await oracle.pushReport(1000000000000000000, { from: A });
    });
  });
});


contract('MarketOracle:addSource:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.addSource(A, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.addSource(A, { from: B }))
    ).to.be.true;
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  describe('when source is part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(A);
      await oracle.addSource(B);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      r = await oracle.removeSource(A);
    });

    it('should emit SourceRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceRemoved');
      expect(event.args.source).to.eq(A);
    });
    it('should remove source from the whitelist', async function () {
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(1);
      expect(
          await chain.isEthException(oracle.pushReport(1000000000000000000, { from: A }))
      ).to.be.true;
      await oracle.pushReport(1000000000000000000, { from: B });
    });
  });
});

contract('MarketOracle:removeSource', async function (accounts) {
  describe('when source is NOT part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(A);
      await oracle.addSource(B);
      (await oracle.whitelistSize.call()).should.be.bignumber.eq(2);
      expect(
          await chain.isEthException(oracle.removeSource(C, { from: deployer }))
      ).to.be.true;
    });
  });
});

contract('MarketOracle:removeSource:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(A);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.removeSource(A, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.removeSource(A, { from: A }))
    ).to.be.true;
  });
});

contract('MarketOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addSource(A);
    await oracle.addSource(B);
    await oracle.addSource(C);
    await oracle.addSource(D);


    await oracle.pushReport(1000000000000000000, { from: D });
    await oracle.pushReport(1041000000000000000, { from: B });
    await oracle.pushReport(1053200000000000000, { from: A });
    await oracle.pushReport(2041000000000000000, { from: C });
  });

  describe('when the sources are live', function () {
    it('should calculate the combined market rate and volume', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1047100000000000000);
    });
  });
});

contract('MarketOracle:getData', async function (accounts) {
  describe('when one of sources has expired', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(A);
      await oracle.addSource(B);
      await oracle.addSource(C);
      await oracle.addSource(D);

      await oracle.pushReport(2041000000000000000, { from: C });
      await chain.waitForSomeTime(3601);
      await oracle.pushReport(1041000000000000000, { from: B });
      await oracle.pushReport(1000000000000000000, { from: D });
      await oracle.pushReport(1053200000000000000, { from: A });

    });

    it('should emit SourceExpired message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(C);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1041000000000000000);
    });
  });
});

contract('MarketOracle:getData', async function (accounts) {
  describe('when all sources have expired', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addSource(A);
      await oracle.addSource(B);
      await oracle.pushReport(1053200000000000000, { from: A });
      await oracle.pushReport(1041000000000000000, { from: B });
      await chain.waitForSomeTime(3601);
    });

    it('should emit 2 SourceExpired messages', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      let event = logs[0];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(A);

      event = logs[1];
      expect(event.event).to.eq('LogSourceExpired');
      expect(event.args.source).to.eq(B);
    });
    it('should return false and 0', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
      resp[0].should.be.bignumber.eq(0);
    });
  });
});
