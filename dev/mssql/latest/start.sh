#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-mssql-latest down --remove-orphans
docker compose -p sequelize-mssql-latest up -d

./../../wait-until-healthy.sh sequelize-mssql-latest

docker exec sequelize-mssql-latest \
  /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U SA -P "Password12!" -Q "CREATE DATABASE sequelize_test; ALTER DATABASE sequelize_test SET READ_COMMITTED_SNAPSHOT ON;"

DIALECT=mssql ts-node ../../check-connection.ts
