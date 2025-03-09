#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-hana-oldest down --remove-orphans
docker compose -p sequelize-hana-oldest up -d

./../../wait-until-healthy.sh sequelize-hana-oldest

DIALECT=hana ../../../node_modules/.bin/ts-node ../../check-connection.ts
