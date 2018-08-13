#!/usr/bin/env bash
DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PROJECT_DIR=$DIR/../

# Exit script as soon as a command fails.
set -o errexit

process-pid(){
  lsof -t -i:$1
}

run-unit-tests(){
  npx truffle \
    --network $1 \
    test \
    $PROJECT_DIR/test/unit/*.js
}

run-load-tests(){
  npx truffle \
    --network $1 \
    exec \
    $PROJECT_DIR/test/load/gas_utilization.js verify
}

read REF GANACHE_PORT < <(npx get-network-config ganacheUnitTest)

# Is chain running?
if [ $(process-pid $GANACHE_PORT) ]
then
  REFRESH_GANACHE=0
else
  REFRESH_GANACHE=1
fi

# Stop chain
cleanupGanache(){
  if [ "$REFRESH_GANACHE" == "1" ]
  then
    npx stop-chain "ganacheUnitTest"
  fi
}

echo "------Start blockchain(s)"
npx start-chain "ganacheUnitTest"

echo "------Deploying contracts"
npx truffle  migrate --reset --network "ganacheUnitTest"

echo "------Running unit tests"
run-unit-tests "ganacheUnitTest"

echo "------Running gas utilization test"
run-load-tests "ganacheUnitTest"

trap cleanupGanache EXIT

exit 0
