const DataProviderFactory = artifacts.require('DataProviderFactory.sol');
const DataProvider = artifacts.require('DataProvider.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(web3.BigNumber))
  .should();

contract('DataProviderFactory', async function (accounts) {
  let factory;
  const A = accounts[1];

  before(async function () {
    factory = await DataProviderFactory.new();
  });

  describe('createProvider', function () {
    let r, providerContractAddr;
    before(async function () {
      r = await factory.createProvider('coin-market-cap', 3600, { from: A });
      providerContractAddr = r.logs[0].args.provider;
    });

    it('should create a data provider contract', async function () {
      expect(await chain.isContract(providerContractAddr)).to.be.true;
    });
    it('should set the provider name and expiration time', async function () {
      const dataProvider = DataProvider.at(providerContractAddr);
      expect(await dataProvider.name.call()).to.eq('coin-market-cap');
      (await dataProvider.reportExpirationTimeSec.call()).should.be.bignumber.eq(3600);
    });
    it('should transfer ownership to sender', async function () {
      const dataProvider = DataProvider.at(providerContractAddr);
      expect(await dataProvider.owner.call()).to.eq(A);
    });
    it('should emit ProviderCreated message', async function () {
      expect(r.logs[0].event).to.eq('LogProviderCreated');
      const providerCreatedEvent = r.logs[0].args;
      expect(providerCreatedEvent.owner).to.eq(A);
    });
  });
});
