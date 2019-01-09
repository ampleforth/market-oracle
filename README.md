# Market Oracle

[![Build Status](https://travis-ci.com/frgprotocol/market-oracle.svg?token=xxNsLhLrTiyG3pc78i5v&branch=master)](https://travis-ci.com/frgprotocol/market-oracle)&nbsp;&nbsp;
[![Coverage Status](https://coveralls.io/repos/github/frgprotocol/market-oracle/badge.svg?branch=master&t=K8tHT9)](https://coveralls.io/github/frgprotocol/market-oracle?branch=master)


This repository is a collection of [Ethereum smart contracts](http://ampleforth.org/docs) that enable aggregation of offchain market information from multiple sources.


## Table of Contents

- [Install](#install)
- [Testing](#testing)
- [Contribute](#contribute)
- [License](#license)


## Install

```bash
# Install project dependencies
npm install

# Install ethereum local blockchain(s) and associated dependencies
npx setup-local-chains
```

## Testing

``` bash
# You can use the following command to start a local blockchain instance
npx start-chain [ganacheUnitTest|gethUnitTest]

# Run all unit tests
npm test

# Run unit tests in isolation
npx truffle --network ganacheUnitTest test test/unit/market_source.js
```

## Contribute

To report bugs within this package, please create an issue in this repository.
When submitting code ensure that it is free of lint errors and has 100% test coverage.

``` bash
# Lint code
npm run lint

# View code coverage
npm run coverage
```

## License

[MIT (c) 2018 Fragments, Inc.](./LICENSE)
