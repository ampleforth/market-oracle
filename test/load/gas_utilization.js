/*
  npm run truffle exec test/load/gas_utilization.js save
    => Computes the gas used by various contract functions and writes it to a logs/gas-utilization.yaml

  npm run truffle exec test/load/gas_utilization.js verify
    => Verifies if the gas amounts in logs/gas-utilization.yaml is consistent with the computed values
*/
const ExchangeRateAggregator = artifacts.require('ExchangeRateAggregator.sol');
const ExchangeRateFactory = artifacts.require('ExchangeRateFactory.sol');
const ExchangeRateSource = artifacts.require('ExchangeRateSource.sol');

const yaml = require('js-yaml');
const fs = require('fs');
const BigNumber = require('bignumber.js');
const rp = require('request-promise');

const APP_ROOT_PATH = require('app-root-path');
const _require = APP_ROOT_PATH.require;
const generateYaml = _require('/util/yaml_generator');
const BlockchainCaller = _require('/util/blockchain_caller');
const chain = new BlockchainCaller(web3);

const network = artifacts.options._values.network;
const truffleConfig = _require('/truffle.js');
const config = truffleConfig.networks[network];
const chainConfig = yaml.safeLoad(fs.readFileSync(`${APP_ROOT_PATH}/migrations/deployments/${config.ref}.yaml`));

let gasPriceEth, ethUSDRate;
const computedGasUtilization = {};

async function loadTransactionMetrics (msg, txR) {
  const tx = await chain.getTransactionMetrics((txR.tx || txR));
  console.log('\t=Gas Used:', tx.gasUsed);
  console.log('\t=ETH value:', gasPriceEth.mul(tx.gasUsed).toString());
  console.log('\t=USD value:', gasPriceEth.mul(tx.gasUsed).mul(ethUSDRate).toString());
  console.log('\t=Bytecode Size (bytes):', tx.byteCodeSize);
  computedGasUtilization[msg] = tx.gasUsed;
}

function cleanRoomTx (msg, fn) {
  console.log('-', msg);
  return chain.cleanRoom(async () => {
    loadTransactionMetrics(msg, await fn());
  });
}

async function ethConversionRate () {
  try {
    const resp = await rp('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD');
    const rate = JSON.parse(resp).USD;
    return parseFloat(rate);
  } catch (e) {
    console.warn('Failed to fetch ETH/USD converstion rate, using 1ETH=700$');
    return 700;
  }
}

async function computeGasUtilization () {
  ethUSDRate = await ethConversionRate();
  gasPriceEth = new BigNumber(config.gasPrice).div(10 ** 18);

  const accounts = await chain.getUserAccounts();
  const deployer = accounts[0];

  const exchangeRateFactory = ExchangeRateFactory.at(chainConfig.exchangeRateFactory);
  const exchangeRateAggregator = ExchangeRateAggregator.at(chainConfig.exchangeRateAggregator);

  const callerConfig = {
    from: deployer,
    gas: config.gas
  };

  console.log('GasPrice (WEI):', config.gasPrice);
  console.log('USD to ETH:', ethUSDRate);
  console.log('Block gas limit:', await chain.getBlockGasLimit());
  console.log('-----------------------------------------------------');

  console.log('CONTRACT DEPLOYMENT GAS UTILIZATION');
  console.log('-----------------------------------------------------');

  await cleanRoomTx('ExchangeRateFactory:DEPLOYMENT', () => chainConfig.exchangeRateFactoryTx);
  console.log('-----------------------------------------------------');

  await cleanRoomTx('ExchangeRateAggregator:DEPLOYMENT', () => chainConfig.exchangeRateAggregatorTx);
  console.log('**************************************************************');

  await cleanRoomTx('ExchangeRateAggregator:aggregateExchangeRates(10 sources)', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await exchangeRateFactory.createSource('GDAX' + toString(i), callerConfig);
      const s = ExchangeRateSource.at(r.logs[0].args.source);
      exchangeRateAggregator.addSource(s.address);
      await s.reportRate(1050000000000000000, 1, callerConfig);
    }
    return exchangeRateAggregator.aggregateExchangeRates();
  });
  console.log('-----------------------------------------------------');
}

function verifyGasUtilization (gasUtilization, _gasUtilization) {
  let k;
  for (k in gasUtilization) {
    if (Object.prototype.hasOwnProperty.call(gasUtilization, k)) {
      const utilization = new BigNumber(gasUtilization[k]);
      const _utilization = new BigNumber(_gasUtilization[k]);
      if (!utilization.minus(_utilization).eq(0)) {
        throw new Error(`Gas utilization increased significantly for fn ${k}`);
      }
    }
  }
}

/*
  Computes the estimated gas for all public/external contract functions
*/
module.exports = async function (callback) {
  const option = (process.argv[process.argv.length - 1] || 'save');
  const opPath = `${APP_ROOT_PATH}/test/logs/gas-utilization.yaml`;
  console.log('**************************************************************');
  await computeGasUtilization();
  if (option === 'save') {
    await generateYaml(computedGasUtilization, opPath);
    console.log('Saved gas utilization information to', opPath);
  } else if (option === 'verify') {
    const _gasUtilization = yaml.safeLoad(fs.readFileSync(opPath));
    verifyGasUtilization(computedGasUtilization, _gasUtilization);
    console.log('NO SIGNIFICANT CHANGE in gas utilization');
  }
  console.log('**************************************************************');
};
