// TODO(naguib): Add gas usage checks
const MedianOracle = artifacts.require('MedianOracle');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

let oracle, deployer, A, B, C, D, r;

async function setupContractsAndAccounts (accounts) {
  deployer = accounts[0];
  A = accounts[1];
  B = accounts[2];
  C = accounts[3];
  D = accounts[4];
  oracle = await MedianOracle.new(60,10,1);
}

contract('MedianOracle:providersSize', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should return the number of sources added to the whitelist', async function () {
    await oracle.addProvider(A);
    await oracle.addProvider(B);
    await oracle.addProvider(C);
    (await oracle.providersSize.call()).should.be.bignumber.eq(3);
  });
});

contract('MedianOracle:addProvider', async function (accounts) {
  describe('when successful', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      (await oracle.providersSize.call()).should.be.bignumber.eq(0);
      r = await oracle.addProvider(A);
    });

    it('should emit SourceAdded message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('ProviderAdded');
      expect(event.args.provider).to.eq(A);
    });
    it('should add source to the whitelist', async function () {
      (await oracle.providersSize.call()).should.be.bignumber.eq(1);
    });
    it('should not add an existing source to the whitelist', async function () {
      expect(await chain.isEthException(oracle.addProvider(A, { from: deployer }))).to.be.true;
    });
  });
});

contract('MedianOracle:pushReport', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });
  it('should only push from authorized source', async function () {
    expect(
      await chain.isEthException(oracle.pushReport(1000000000000000000, { from: A }))
    ).to.be.true;
    oracle.addProvider(A, { from: deployer });
    await oracle.pushReport(1000000000000000000, { from: A });
  });
});

contract('MedianOracle:addProvider:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.addProvider(A, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.addProvider(A, { from: B }))
    ).to.be.true;
  });
});

contract('MedianOracle:removeProvider', async function (accounts) {
  describe('when source is part of the whitelist', () => {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(A);
      await oracle.addProvider(B);
      await oracle.addProvider(C);
      await oracle.addProvider(D);
      (await oracle.providersSize.call()).should.be.bignumber.eq(4);
      r = await oracle.removeProvider(B);
    });
    it('should emit SourceRemoved message', async function () {
      const logs = r.logs;
      const event = logs[0];
      expect(event.event).to.eq('ProviderRemoved');
      expect(event.args.provider).to.eq(B);
    });
    it('should remove source from the whitelist', async function () {
      (await oracle.providersSize.call()).should.be.bignumber.eq(3);
      expect(
        await chain.isEthException(oracle.pushReport(1000000000000000000, { from: B }))
      ).to.be.true;
      await oracle.pushReport(1000000000000000000, { from: D });
    });
  });
});

contract('MedianOracle:removeProvider', async function (accounts) {
  beforeEach(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);
    await oracle.addProvider(B);
    await oracle.addProvider(C);
    await oracle.addProvider(D);
    (await oracle.providersSize.call()).should.be.bignumber.eq(4);
  });
  it('Remove last element', async function () {
    r = await oracle.removeProvider(D);
    (await oracle.providersSize.call()).should.be.bignumber.eq(3);
    expect(await oracle.providers.call(0)).to.eq(A);
    expect(await oracle.providers.call(1)).to.eq(B);
    expect(await oracle.providers.call(2)).to.eq(C);
  });

  it('Remove middle element', async function () {
    r = await oracle.removeProvider(B);
    (await oracle.providersSize.call()).should.be.bignumber.eq(3);
    expect(await oracle.providers.call(0)).to.eq(A);
    expect(await oracle.providers.call(1)).to.eq(D);
    expect(await oracle.providers.call(2)).to.eq(C);
  });

  it('Remove only element', async function () {
    r = await oracle.removeProvider(A);
    r = await oracle.removeProvider(B);
    r = await oracle.removeProvider(C);
    (await oracle.providersSize.call()).should.be.bignumber.eq(1);
    expect(await oracle.providers.call(0)).to.eq(D);
    r = await oracle.removeProvider(D);
    (await oracle.providersSize.call()).should.be.bignumber.eq(0);
  });
});

contract('MedianOracle:removeProvider', async function (accounts) {
  it('when source is NOT part of the whitelist', async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);
    await oracle.addProvider(B);
    (await oracle.providersSize.call()).should.be.bignumber.eq(2);
    await oracle.removeProvider(C, { from: deployer });
    (await oracle.providersSize.call()).should.be.bignumber.eq(2);
    expect(await oracle.providers.call(0)).to.eq(A);
    expect(await oracle.providers.call(1)).to.eq(B);
  });
});

contract('MedianOracle:removeProvider:accessControl', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);
  });

  it('should be callable by owner', async function () {
    expect(
      await chain.isEthException(oracle.removeProvider(A, { from: deployer }))
    ).to.be.false;
  });

  it('should NOT be callable by non-owner', async function () {
    expect(
      await chain.isEthException(oracle.removeProvider(A, { from: A }))
    ).to.be.true;
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);
    await oracle.addProvider(B);
    await oracle.addProvider(C);
    await oracle.addProvider(D);

    await oracle.pushReport(1000000000000000000, { from: D });
    await oracle.pushReport(1041000000000000000, { from: B });
    await oracle.pushReport(1053200000000000000, { from: A });
    await oracle.pushReport(2041000000000000000, { from: C });
    await chain.waitForSomeTime(10);
  });

  describe('when the reports are valid', function () {
    it('should calculate the combined market rate and volume', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1047100000000000000);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  describe('when one of reports has expired', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(A);
      await oracle.addProvider(B);
      await oracle.addProvider(C);
      await oracle.addProvider(D);

      await oracle.pushReport(2041000000000000000, { from: C });
      await chain.waitForSomeTime(61);
      await oracle.pushReport(1041000000000000000, { from: B });
      await oracle.pushReport(1000000000000000000, { from: D });
      await oracle.pushReport(1053200000000000000, { from: A });
      await chain.waitForSomeTime(10);
    });

    it('should emit ReportTimestampOutOfRange message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(C);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1041000000000000000);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  describe('when one of the reports is too recent', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(A);
      await oracle.addProvider(B);
      await oracle.addProvider(C);
      await oracle.addProvider(D);

      await oracle.pushReport(2041000000000000000, { from: C });
      await oracle.pushReport(1000000000000000000, { from: D });
      await oracle.pushReport(1053200000000000000, { from: A });
      await chain.waitForSomeTime(10);
      await oracle.pushReport(1041000000000000000, { from: B });
    });

    it('should emit ReportTimestampOutOfRange message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(B);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1053200000000000000);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  describe('when not enough providers are valid', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(A);
      await oracle.addProvider(B);
      await oracle.addProvider(C);
      await oracle.addProvider(D);
      oracle.setMinimumProviders(4);

      await oracle.pushReport(2041000000000000000, { from: C });
      await oracle.pushReport(1000000000000000000, { from: D });
      await oracle.pushReport(1053200000000000000, { from: A });
      await chain.waitForSomeTime(10);
      await oracle.pushReport(1041000000000000000, { from: B });
    });

    it('should emit ReportTimestampOutOfRange message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(B);
    });
    it('should calculate the exchange rate', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
      resp[0].should.be.bignumber.eq(0);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  describe('when all reports have expired', function () {
    before(async function () {
      await setupContractsAndAccounts(accounts);
      await oracle.addProvider(A);
      await oracle.addProvider(B);
      await oracle.pushReport(1053200000000000000, { from: A });
      await oracle.pushReport(1041000000000000000, { from: B });
      await chain.waitForSomeTime(61);
    });

    it('should emit 2 ReportTimestampOutOfRange messages', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      let event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(A);

      event = logs[1];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(B);
    });
    it('should return false and 0', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
      resp[0].should.be.bignumber.eq(0);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(61);
    await oracle.pushReport(1200000000000000000, { from: A });
  });

  describe('when recent is too recent and past is too old', function () {
    it('should emit ReportTimestampOutOfRange message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(A);
    });

    it('should fail', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(10);
    await oracle.pushReport(1200000000000000000, { from: A });
    await chain.waitForSomeTime(1);
    oracle.setReportDelaySec(30);
  });

  describe('when recent is too recent and past is too recent', function () {
    it('should emit ReportTimestampOutOfRange message', async function () {
      const resp = await oracle.getData();
      const logs = resp.logs;
      const event = logs[0];
      expect(event.event).to.eq('ReportTimestampOutOfRange');
      expect(event.args.provider).to.eq(A);
    });

    it('should fail', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(30);
    await oracle.pushReport(1200000000000000000, { from: A });
    await chain.waitForSomeTime(4);
  });

  describe('when recent is too recent and past is valid', function () {
    it('should succeeded', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1100000000000000000);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(30);
    await oracle.pushReport(1200000000000000000, { from: A });
    await chain.waitForSomeTime(10);
  });

  describe('when recent is not too recent nor too old', function () {
    it('should succeed', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.true;
      resp[0].should.be.bignumber.eq(1200000000000000000);
    });
  });
});

contract('MedianOracle:getData', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(30);
    await oracle.pushReport(1200000000000000000, { from: A });
    await chain.waitForSomeTime(80);
  });

  describe('when recent is not too recent but too old', function () {
    it('should fail', async function () {
      const resp = await oracle.getData.call();
      expect(resp[1]).to.be.false;
    });
  });
});

contract('MedianOracle:PurgeReports', async function (accounts) {
  before(async function () {
    await setupContractsAndAccounts(accounts);
    await oracle.addProvider(A);

    await oracle.pushReport(1100000000000000000, { from: A });
    await chain.waitForSomeTime(20);
    await oracle.pushReport(1200000000000000000, { from: A });
    await chain.waitForSomeTime(20);
    await oracle.purgeReports({ from: A });
  });

  it('data not available after purge', async function () {
    const resp = await oracle.getData.call();
    expect(resp[1]).to.be.false;
  });
  it('data available after another report', async function () {
    await oracle.pushReport(1300000000000000000, { from: A });
    await chain.waitForSomeTime(20);
    const resp = await oracle.getData.call();
    expect(resp[1]).to.be.true;
    resp[0].should.be.bignumber.eq(1300000000000000000);
  });

  it('cannot purge a non-whitelisted provider', async function () {
    expect(await chain.isEthException(oracle.purgeReports({ from: B }))).to.be.true;
    expect(await chain.isEthException(oracle.purgeReports({ from: A }))).to.be.false;
    await oracle.removeProvider(A);
    expect(await chain.isEthException(oracle.purgeReports({ from: A }))).to.be.true;
  });
});
