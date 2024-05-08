#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-hana-latest down --remove-orphans
docker compose -p sequelize-hana-latest up -d

./../../wait-until-healthy.sh sequelize-hana-latest

# TODO uncomment ts-node
#DIALECT=hana ../../../node_modules/.bin/ts-node ../../check-connection.ts

docker exec sequelize-hana-latest \
  bash -c "source ~/.bashrc && HDB info"

sleep 40

docker exec sequelize-hana-latest \
  bash -c "source ~/.bashrc && hdbsql -n 127.0.0.1:39013 -i 90 -d HXE -u system -p HXEHana1 'select 39013 from dummy;'"
