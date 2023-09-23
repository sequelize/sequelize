#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-db2-oldest down --remove-orphans
docker compose -p sequelize-db2-oldest up -d

./../wait-until-healthy.sh sequelize-db2-oldest

DIALECT=db2 ts-node ../../check-connection.ts
