#!/bin/bash

# Runs tests for all dialects
# Specify the test you want to run on .mocharc.jsonc on packages/core with the following content:
# {
#   "file": "test/integration/query-builder/query-builder.test.js"
# }
# See https://github.com/sequelize/sequelize/blob/main/CONTRIBUTING.md#41-running-only-some-tests
# Remember to run the `start.sh` scripts for the dialects you want to test from the dev folder.

DIALECT=sqlite3 yarn mocha && \
DIALECT=mysql yarn mocha && \
DIALECT=mariadb yarn mocha && \
DIALECT=postgres yarn mocha && \
# DIALECT=mssql yarn mocha && \
# DIALECT=snowflake yarn mocha && \  ## Experimental
# DIALECT=ibmi yarn mocha && \       ## Experimental
# DIALECT=db2 yarn mocha && \        ## No matching manifest for arm64
echo "Done"