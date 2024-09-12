#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-mssql-2019 down --remove-orphans
docker-compose -p sequelize-mssql-2019 up -d

./../../wait-until-healthy.sh sequelize-mssql-2019

docker exec sequelize-mssql-2019 \
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "Password12!" -Q "CREATE DATABASE sequelize_test; ALTER DATABASE sequelize_test SET READ_COMMITTED_SNAPSHOT ON;"

DIALECT=mssql node check.js

echo "Local MSSQL-2019 instance is ready for Sequelize tests."
