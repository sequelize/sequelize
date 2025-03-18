#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-mssql-oldest down --remove-orphans
docker compose -p sequelize-mssql-oldest up -d

sleep 10

docker logs sequelize-mssql-oldest

# Copy logs from the container (even if it's not running)
docker cp sequelize-mssql-oldest:/var/opt/mssql/log . 2>/dev/null || echo "No logs found in container."

# Find the latest MSSQL log directory
LOG_DIR=$(ls -d ./log/core.sqlservr.*.d/log 2>/dev/null | sort -r | head -n 1 || echo "")

if [[ -n "$LOG_DIR" ]]; then
  echo "Copying logs from: $LOG_DIR"
  mkdir -p ./mssql-logs  # Ensure the destination directory exists
  cp "$LOG_DIR/info.log" ./mssql-logs/info.log 2>/dev/null || echo "info.log not found in $LOG_DIR"
  
  # Debugging: List files in the log directory
  echo "Contents of $LOG_DIR:"
  ls -lah "$LOG_DIR"

  # Output log contents
  if [[ -f "./mssql-logs/info.log" ]]; then
    cat ./mssql-logs/info.log
  else
    echo "Log file empty or missing"
  fi
else
  echo "No log directory found!"
fi


docker exec sequelize-mssql-oldest \
  /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "Password12!" -Q "CREATE DATABASE sequelize_test; ALTER DATABASE sequelize_test SET READ_COMMITTED_SNAPSHOT ON;"

DIALECT=mssql ts-node ../../check-connection.ts
