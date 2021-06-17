#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-postgres-10 down --remove-orphans
docker-compose -p sequelize-postgres-10 up -d

./../../wait-until-healthy.sh sequelize-postgres-10

# docker exec sequelize-postgres-10 \
#   bash -c "export PGPASSWORD=sequelize_test && psql -h localhost -p 5432 -U sequelize_test sequelize_test -c '\l'"

echo "Local Postgres-10 instance is ready for Sequelize tests."
