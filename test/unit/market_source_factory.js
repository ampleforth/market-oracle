const MarketSourceFactory = artifacts.require('MarketSourceFactory.sol');
const MarketSource = artifacts.require('MarketSource.sol');

const _require = require('app-root-path').require;
const { ContractEventSpy } = _require('/util/spies');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

contract('MarketSourceFactory', async accounts => {
  let factory;
  const A = accounts[1];

  before(async function () {
    factory = await MarketSourceFactory.deployed();
  });

  describe('createSource', () => {
    let createSourceSpy, sourceContractAddr;
    before(async () => {
      createSourceSpy = new ContractEventSpy([
        factory.SourceCreated
      ]);
      createSourceSpy.watch();
      const r = await factory.createSource('GDAX', { from: A });
      sourceContractAddr = r.logs[0].args.source;
    });
    after(async () => {
      createSourceSpy.stopWatching();
    });

    it('should emit SourceCreated message', async () => {
      const sourceCreatedEvent = createSourceSpy.getEventByName('SourceCreated');
      expect(sourceCreatedEvent).to.exist;
      expect(sourceCreatedEvent.args.owner).to.eq(A);
      expect(sourceCreatedEvent.args.name).to.eq('GDAX');
    });
    it('should create exchange rate source contracts', async () => {
      expect(await chain.isContract(sourceContractAddr)).to.be.true;
    });
    it('should transfer ownership to sender', async () => {
      const marketSource = MarketSource.at(sourceContractAddr);
      expect(await marketSource.owner.call()).to.eq(A);
    });
  });
});
