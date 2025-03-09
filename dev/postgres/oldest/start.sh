#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-postgres-oldest down --remove-orphans
docker compose -p sequelize-postgres-oldest up -d

./../../wait-until-healthy.sh sequelize-postgres-oldest

DIALECT=postgres ts-node ../../check-connection.ts

docker exec sequelize-postgres-oldest \
   bash -c "export PGPASSWORD=sequelize_test && psql -h localhost -p 5432 -U sequelize_test sequelize_test -c 'CREATE EXTENSION IF NOT EXISTS btree_gist; CREATE EXTENSION IF NOT EXISTS hstore; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"'"
