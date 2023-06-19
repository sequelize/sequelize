#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-mariadb-latest down --remove-orphans
docker compose -p sequelize-mariadb-latest up -d

./../../wait-until-healthy.sh sequelize-mariadb-latest

docker exec sequelize-mariadb-latest \
  mariadb --host 127.0.0.1 --port 3306 -uroot -psequelize_test -e "GRANT ALL ON *.* TO 'sequelize_test'@'%' with grant option; FLUSH PRIVILEGES;"

DIALECT=mariadb ts-node ../../check-connection.ts
