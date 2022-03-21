#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

# Cloning the docker-images repo from git
if [ ! -d docker-images ]
then
    git clone https://github.com/oracle/docker-images.git
fi
# Building the Oracle DB container in docker
./docker-images/OracleDatabase/SingleInstance/dockerfiles/buildContainerImage.sh -v 21.3.0 -x

# Remove an existing Oracle DB docker image
docker-compose -p oraclexedb21c down --remove-orphans

# Bring up new Oracle DB docker image
docker-compose -p oraclexedb21c up -d

# Wait until Oracle DB is set up and docker state is healthy
./wait-until-healthy.sh oraclexedb21c

# Create user test/password and grant all privileges to it
sqlplus system/password@localhost:51521/XEPDB1 << EOF
create user sequelizetest identified by sequelizepassword; 
grant all privileges to sequelizetest identified by sequelizepassword; 
exit;
EOF

echo "Local Oracle DB - 21c docker instance is ready for use!"

mkdir ~/Downloads/oracle && 
wget https://download.oracle.com/otn_software/linux/instantclient/215000/instantclient-basic-linux.x64-21.5.0.0.0dbru.zip --no-check-certificate && 
unzip instantclient-basic-linux.x64-21.5.0.0.0dbru.zip -d ~/Downloads/oracle/ &&
mv ~/Downloads/oracle/instantclient_21_5 ~/Downloads/oracle/instantclient &&
export LD_LIBRARY_PATH=~/Downloads/oracle/instantclient:$LD_LIBRARY_PATH &&
export TNS_ADMIN=~/Downloads/oracle/instantclient/network/admin:$TNS_ADMIN

echo "Local Oracle instant client has been setup!"