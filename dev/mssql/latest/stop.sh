#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


if which docker-compose > /dev/null; then
  docker-compose -p sequelize-mssql-latest down --remove-orphans
else
  docker compose -p sequelize-mssql-latest down --remove-orphans
fi

echo "Local latest supported MSSQL instance stopped (if it was running)."
