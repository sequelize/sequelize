#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p sequelize-mysql-80 down --remove-orphans

echo "Local MySQL-8.0 instance stopped (if it was running)."
