#!/usr/bin/env bash
# Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-oracle-latest down --remove-orphans
docker compose -p sequelize-oracle-latest up -d

./../../wait-until-healthy.sh sequelize-oracle-latest

sleep 30s

docker cp ../privileges.sql sequelize-oracle-latest:/opt/oracle/.

docker exec -t sequelize-oracle-latest sqlplus system/password@localhost:1521/XEPDB1 @privileges.sql

DIALECT=oracle ts-node ../../check-connection.ts
