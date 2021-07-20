#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-mysql-57 down --remove-orphans
docker-compose -p sequelize-mysql-57 up -d

./../../wait-until-healthy.sh sequelize-mysql-57

docker exec sequelize-mysql-57 \
  mysql --host 127.0.0.1 --port 3306 -uroot -psequelize_test -e "GRANT ALL ON *.* TO 'sequelize_test'@'%' with grant option; FLUSH PRIVILEGES;"

node check.js

echo "Local MySQL-5.7 instance is ready for Sequelize tests."
