#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-cockroachdb-oldest down --remove-orphans
docker compose -p sequelize-cockroachdb-oldest up -d

sleep 1.0
./../../wait-until-healthy.sh sequelize-cockroachdb-oldest