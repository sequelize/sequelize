#!/usr/bin/env bash
# Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-oracle-oldest down --remove-orphans

echo "Local oldest supported Oracle DB instance stopped (if it was running)."
