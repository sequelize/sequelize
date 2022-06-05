#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-pg-12 down --remove-orphans
docker-compose -p sequelize-pg-12 up -d

./../../wait-until-healthy.sh sequelize-pg-12

# docker exec sequelize-pg-12 \
#   bash -c "export PGPASSWORD=sequelize_test && psql -h localhost -p 5432 -U sequelize_test sequelize_test -c '\l'"

# test connection with Sequelize
DIALECT=postgres node ../../db-connection-check.js

echo "Local Postgres-12 instance is ready for Sequelize tests."
