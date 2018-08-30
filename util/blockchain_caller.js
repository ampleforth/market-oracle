// A wrapper on top of web3 to help interact with an underlying blockchain
const SolidityEvent = require('web3/lib/web3/event.js');

class BlockchainCaller {
  constructor (web3) {
    this._web3 = web3;
  }
  get web3 () {
    return this._web3;
  }
  rpcmsg (method, params = []) {
    const id = Date.now();
    return {
      jsonrpc: '2.0',
      method: method,
      params: params,
      'id': id
    };
  }
}

BlockchainCaller.prototype.sendRawToBlockchain = function (method, params) {
  return new Promise((resolve, reject) => {
    this.web3.currentProvider.sendAsync(this.rpcmsg(method, params), function (e, r) {
      if (e) reject(e);
      resolve(r);
    });
  });
};

BlockchainCaller.prototype.waitForSomeTime = function (duration) {
  return this.sendRawToBlockchain('evm_increaseTime', [duration]);
};

BlockchainCaller.prototype.waitForOneBlock = function () {
  return this.sendRawToBlockchain('evm_mine');
};

BlockchainCaller.prototype.waitForNBlocks = async function (n) {
  for (let i = 0; i < n; i++) {
    await this.waitForOneBlock();
  }
};

BlockchainCaller.prototype.getUserAccounts = async function () {
  const accounts = await this.sendRawToBlockchain('eth_accounts');
  return accounts.result;
};

BlockchainCaller.prototype.snapshotChain = async function () {
  const snapshot = await this.sendRawToBlockchain('evm_snapshot');
  return snapshot;
};

BlockchainCaller.prototype.revertToSnapshot = async function (snapshot) {
  const didRevert = await this.sendRawToBlockchain('evm_revert', [snapshot.result]);
  if (!didRevert.result) throw new Error('Revert failed');
  return didRevert.result;
};

BlockchainCaller.prototype.cleanRoom = async function (fn) {
  const snapshot = await this.snapshotChain();
  await fn();
  await this.revertToSnapshot(snapshot);
};

BlockchainCaller.prototype.isEthException = async function (promise) {
  let msg = 'No expected ETH Exception';
  try {
    if (promise.then) { await promise; } else { await promise(); }
  } catch (e) {
    msg = e.message;
  }
  return (
    msg.includes('VM Exception while processing transaction: revert') ||
    msg.includes('exited with an error (status 0)')
  );
};

BlockchainCaller.prototype.getBlockGasLimit = async function () {
  const block = await this.web3.eth.getBlock('latest');
  return block.gasLimit;
};

BlockchainCaller.prototype.getTransactionMetrics = async function (hash) {
  const txR = await this.web3.eth.getTransactionReceipt(hash);
  const tx = await this.web3.eth.getTransaction(hash);
  return {
    gasUsed: txR.gasUsed,
    gasPrice: tx.gasPrice,
    byteCodeSize: (tx.input.length * 4 / 8)
  };
};

BlockchainCaller.prototype.isContract = async function (address) {
  // getCode returns '0x0' if address points to a wallet else it returns the contract bytecode
  const code = await this.web3.eth.getCode(address);
  return (code !== '0x0');
};

// Inspired from https://github.com/OpenZeppelin/openzeppelin-solidity/blob/master/test/helpers/decodeLogs.js
BlockchainCaller.prototype.decodeLogs = function(logs, contract, address){
  return logs.map(log => {
    const event = new SolidityEvent(null, contract.events[log.topics[0]], address);
    return event.decode(log);
  });
};

module.exports = BlockchainCaller;
