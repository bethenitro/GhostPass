#!/bin/bash

# Load environment variables from .env.test
set -a
source .env.test
set +a

# Run the test passed as argument
if [ -z "$1" ]; then
  echo "Usage: ./run-test.sh [entry|concession|wallet|reentry|realistic|full|chaos]"
  echo ""
  echo "Examples:"
  echo "  ./run-test.sh entry      # Run entry scan test"
  echo "  ./run-test.sh reentry    # Run re-entry test"
  echo "  ./run-test.sh realistic  # Run realistic venue test (RECOMMENDED)"
  echo "  ./run-test.sh full       # Run full system test"
  exit 1
fi

case "$1" in
  entry)
    npm run test:entry
    ;;
  concession)
    npm run test:concession
    ;;
  wallet)
    npm run test:wallet
    ;;
  full)
    npm run test:full
    ;;
  chaos)
    npm run test:chaos
    ;;
  reentry)
    npm run test:reentry
    ;;
  realistic)
    npm run test:realistic
    ;;
  concurrency)
    npm run test:concurrency
    ;;
  *)
    echo "Unknown test: $1"
    echo "Valid options: entry, concession, wallet, reentry, realistic, concurrency, full, chaos"
    exit 1
    ;;
esac
