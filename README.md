# Exchange Rate Contracts
Set of smart contracts on Ethereum deal with exchange rate reporting and aggregation.

[![Build Status](https://travis-ci.com/frgprotocol/market-oracle.svg?token=xxNsLhLrTiyG3pc78i5v&branch=master)](https://travis-ci.com/frgprotocol/market-oracle)

[![Coverage Status](https://coveralls.io/repos/github/frgprotocol/market-oracle/badge.svg?branch=master&t=K8tHT9)](https://coveralls.io/github/frgprotocol/market-oracle?branch=master)

# Getting started
```bash
# Install project dependencies
npm install

# Install ethereum local blockchain(s) and associated dependencies
npx setup-local-chains
```

# Useful scripts
``` bash
# You can use the following command to start a local blockchain instance
npx start-chain [ganacheUnitTest|gethUnitTest]

# Lint code
npm run lint

# View code coverage
npm run coverage
```

# Testing
```
# Run Unit Tests
npm test

# Run unit tests in isolation
npx truffle --network ganacheUnitTest test test/test_file.js
```
