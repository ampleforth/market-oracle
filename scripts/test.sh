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

run-all-tests(){
  read REF PORT < <(npx get-network-config $1)

  if [ $(process-pid $PORT) ]
  then
    REFRESH=0
  else
    REFRESH=1
    echo "------Start blockchain(s)"
    npx start-chain $1
  fi

  echo "------Running unit tests"
  run-unit-tests $1

  cleanup(){
    if [ "$REFRESH" == "1" ]
    then
      npx stop-chain $1
    fi
  }
  trap cleanup EXIT
}

# Pausing tests #RFC
run-all-tests "ganacheUnitTest"

if [ "${TRAVIS_EVENT_TYPE}" == "cron" ]
then
  run-all-tests "gethUnitTest"
fi

exit 0
