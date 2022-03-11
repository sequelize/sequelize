#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

# Cloning the docker-images repo from git
if [ ! -d docker-images ]
then
    git clone git@github.com:oracle/docker-images.git
fi
# Building the Oracle DB container in docker
./docker-images/OracleDatabase/SingleInstance/dockerfiles/buildContainerImage.sh -v 21.3.0 -x

# Remove an existing Oracle DB docker image
docker-compose -p oraclexedb21c down --remove-orphans

# Bring up new Oracle DB docker image
docker-compose -p oraclexedb21c up -d

# Wait until Oracle DB is set up and docker state is healthy
./../../wait-until-healthy.sh oraclexedb21c

# Create user test/password and grant all privileges to it
sqlplus system/password@localhost:51521/XEPDB1 << EOF
create user test identified by password; 
grant all privileges to test identified by password; 
exit;
EOF

echo "Local Oracle DB - 21c instance is ready for use."