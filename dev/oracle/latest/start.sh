# Copyright (c) 2024, Oracle and/or its affiliates. All rights reserved

#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

# Remove an existing Oracle DB docker image
docker-compose -p oraclexedb down --remove-orphans

# Bring up new Oracle DB docker image
docker-compose -p oraclexedb up -d

# Wait until Oracle DB is set up and docker state is healthy
./../wait-until-healthy.sh oraclexedb

# Moving privileges.sql to docker container
docker cp ../privileges.sql oraclexedb:/opt/oracle/.

# Granting all the needed privileges to sequelizetest user
docker exec -t oraclexedb sqlplus system/password@XEPDB1 @privileges.sql

echo "Local Oracle DB is ready for use!"