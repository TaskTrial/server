#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if test name was provided
if [ -z "$1" ]; then
  echo -e "${RED}Error: Please provide a test name.${NC}"
  echo -e "Usage: ${YELLOW}./run-integration-test.sh auth${NC} (to run auth.integration.test.js)"
  echo -e "       ${YELLOW}./run-integration-test.sh all${NC} (to run all integration tests)"
  exit 1
fi

# Set environment variables
export NODE_ENV=test
export TEST_TYPE=integration

# Clear terminal
clear

echo -e "${BLUE}=== TaskTrial Integration Tests ===${NC}\n"

# Run the specified test
if [ "$1" == "all" ]; then
  echo -e "${BLUE}Running all integration tests...${NC}\n"
  npm run test:integration
else
  # Path is now integration/[testname].integration.test.js
  TEST_FILE="integration/${1}.integration.test.js"
  echo -e "${BLUE}Running integration test for: ${YELLOW}${TEST_FILE}${NC}\n"
  npx jest ${TEST_FILE} --detectOpenHandles --forceExit --runInBand
fi

# Get test exit status
STATUS=$?

if [ $STATUS -eq 0 ]; then
  echo -e "\n${GREEN}✓ Tests completed successfully!${NC}"
else
  echo -e "\n${RED}✗ Tests failed with exit status ${STATUS}${NC}"
fi

exit $STATUS 