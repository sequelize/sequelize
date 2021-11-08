#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-mssql-2019 down --remove-orphans

echo "Local MSSQL-2019 instance stopped (if it was running)."
