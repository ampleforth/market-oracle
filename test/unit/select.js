// TODO(naguib): Fail tests if gas utilization changes
// TODO(naguib): Consider Adding more test scenarios
const SelectMock = artifacts.require('SelectMock');

const BigNumber = web3.BigNumber;
const _require = require('app-root-path').require;
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('Select', () => {
  let select;

  beforeEach(async function () {
    select = await SelectMock.new();
  });

  async function returnVal (tx) {
    return (await tx).logs[0].args.val;
  }

  describe('Select:computeMedian', function () {
    it('not enough elements in array', async function () {
      expect(
        await chain.isEthException(select.computeMedian([1], 2))
      ).to.be.true;
    });
    it('median of 1', async function () {
      const a = new BigNumber(5678);
      (await returnVal(select.computeMedian([a], 1))).should.be.bignumber.eq(a);
    });
    it('median of 2', async function () {
      list = [new BigNumber(10000), new BigNumber(30000)];
      (await returnVal(select.computeMedian(list, 2))).should.be.bignumber.eq(20000);
    });
    it('median of 3', async function () {
      list = [new BigNumber(10000), new BigNumber(30000), new BigNumber(21000)];
      (await returnVal(select.computeMedian(list, 3))).should.be.bignumber.eq(21000);
    });
    it('median of odd lengthed list', async function () {
      const count = 15;
      list = Array.from({length: count}, () => Math.floor(Math.random() * 10 ** 18));
      result = await returnVal(select.computeMedian(list, count));
      list.sort((a, b) => b - a);
      median = new BigNumber(list[Math.floor(count / 2)].toString());
      result.should.be.bignumber.eq(median);
    });
    it('median of even lengthed list', async function () {
      const count = 20;
      list = Array.from({length: count}, () => Math.floor(Math.random() * 10 ** 18));
      result = await returnVal(select.computeMedian(list, count));
      list.sort((a, b) => b - a);
      median = new BigNumber(list[Math.floor(count / 2)].toString());
      median = median.add(new BigNumber(list[Math.floor(count / 2) - 1].toString()));
      median = median.div(2);
      result.should.be.bignumber.eq(median);
    });
  });
});
