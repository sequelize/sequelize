#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-db2-latest down --remove-orphans
docker compose -p sequelize-db2-latest up -d

# Db2 creates the database on first start, which takes 2-4 minutes on a CI runner.
HEALTHCHECK_TIMEOUT=600 ./../../wait-until-healthy.sh sequelize-db2-latest

DIALECT=db2 ts-node ../../check-connection.ts
