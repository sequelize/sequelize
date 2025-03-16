#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-mssql-oldest down --remove-orphans
docker compose -p sequelize-mssql-oldest up -d

sleep 10

docker logs sequelize-mssql-oldest

LOG_DIR=$(docker cp sequelize-mssql-oldest:/var/opt/mssql/log . 2>/dev/null && ls -d ./log/core.sqlservr.*.d/log | sort -r | head -n 1)

if [[ -n "$LOG_DIR" ]]; then
  echo "Copying logs from: $LOG_DIR"
  cp "$LOG_DIR/info.log" ./mssql-logs/info.log || echo "Failed to copy info.log"
  cat ./mssql-logs/info.log || echo "Log file empty or missing"
else
  echo "No log directory found!"
fi


docker exec sequelize-mssql-oldest \
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "Password12!" -Q "CREATE DATABASE sequelize_test; ALTER DATABASE sequelize_test SET READ_COMMITTED_SNAPSHOT ON;"

DIALECT=mssql ts-node ../../check-connection.ts
