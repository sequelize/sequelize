#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-postgres-12 down --remove-orphans
docker-compose -p sequelize-postgres-12 up -d

devdir="$(git rev-parse --show-toplevel)/dev"
$devdir/wait-until-healthy.sh sequelize-postgres-12

# test connection with Sequelize
DIALECT=postgres12 yarn ts-node "$devdir/db-connection-check.ts"

echo "Local Postgres-12 instance is ready for Sequelize tests."
