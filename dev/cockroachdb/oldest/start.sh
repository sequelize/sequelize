#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

docker compose -p sequelize-cockroachdb-oldest down --remove-orphans
docker compose -p sequelize-cockroachdb-oldest up -d

./../../wait-until-healthy.sh sequelize-cockroachdb-oldest

# Making a few changes to make the local single node cluster a bit more faster
# Read more here https://cockroachlabs.com/docs/stable/local-testing.html#use-a-local-single-node-cluster-with-in-memory-storage
docker exec -it sequelize-cockroachdb-oldest ./cockroach sql --insecure --execute="
SET CLUSTER SETTING kv.raft_log.disable_synchronization_unsafe = true;
SET CLUSTER SETTING kv.range_merge.queue_interval = '50ms';
SET CLUSTER SETTING jobs.registry.interval.gc = '30s';
SET CLUSTER SETTING jobs.registry.interval.cancel = '180s';
SET CLUSTER SETTING jobs.retention_time = '15s';
SET CLUSTER SETTING sql.stats.automatic_collection.enabled = false;
SET CLUSTER SETTING kv.range_split.by_load_merge_delay = '5s';
ALTER RANGE default CONFIGURE ZONE USING "gc.ttlseconds" = 600;
ALTER DATABASE system CONFIGURE ZONE USING "gc.ttlseconds" = 600;
DROP DATABASE IF EXISTS sequelize_test;
CREATE DATABASE IF NOT EXISTS sequelize_test;"
