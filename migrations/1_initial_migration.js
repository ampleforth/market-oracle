const Migrations = artifacts.require('./Migrations.sol');
const _require = require('app-root-path').require;
const truffleConfig = _require('/truffle.js');

module.exports = function (deployer, network, addresses) {
  const config = truffleConfig.networks[network];

  const deploymentConfig = {
    gas: config.gas
  };

  return deployer.deploy(Migrations, deploymentConfig);
};
