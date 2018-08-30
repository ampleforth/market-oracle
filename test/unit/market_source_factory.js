const MarketSourceFactory = artifacts.require('MarketSourceFactory.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('MarketSourceFactory', async function (accounts) {
  let factory;
  const A = accounts[1];

  before(async function () {
    factory = await MarketSourceFactory.new();
  });

  describe('createSource', function () {
    let r, sourceContractAddr;
    before(async function () {
      r = await factory.createSource('GDAX', { from: A });
      sourceContractAddr = r.logs[0].args.source;
    });

    it('should emit SourceCreated message', async function () {
      expect(r.logs[0].event).to.eq('SourceCreated');
      const sourceCreatedEvent = r.logs[0].args;
      expect(sourceCreatedEvent.owner).to.eq(A);
      expect(sourceCreatedEvent.name).to.eq('GDAX');
    });
    it('should create exchange rate source contracts', async function () {
      expect(await chain.isContract(sourceContractAddr)).to.be.true;
    });
    it('should transfer ownership to sender', async function () {
      const marketSource = MarketSource.at(sourceContractAddr);
      expect(await marketSource.owner.call()).to.eq(A);
    });
  });
});
