#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

# Remove an existing Oracle DB docker image
docker-compose -p oraclexedb21c down --remove-orphans

# Bring up new Oracle DB docker image
docker-compose -p oraclexedb21c up -d

# Wait until Oracle DB is set up and docker state is healthy
./wait-until-healthy.sh oraclexedb21c

# Moving privileges.sql to docker container
docker cp privileges.sql oraclexedb21c:/opt/oracle/. 

# Granting all the needed privileges to sequelizetest user
docker exec -it oraclexedb21c sqlplus system/password@XEPDB1 @privileges.sql

# Setting up Oracle instant client for oracledb
if [ ! -d  ~/Downloads/oracle ] 
then 
    mkdir ~/Downloads/oracle && 
    wget https://download.oracle.com/otn_software/linux/instantclient/215000/instantclient-basic-linux.x64-21.5.0.0.0dbru.zip --no-check-certificate && 
    unzip instantclient-basic-linux.x64-21.5.0.0.0dbru.zip -d ~/Downloads/oracle/ &&
    rm instantclient-basic-linux.x64-21.5.0.0.0dbru.zip &&
    mv ~/Downloads/oracle/instantclient_21_5 ~/Downloads/oracle/instantclient &&
    export LD_LIBRARY_PATH=~/Downloads/oracle/instantclient:$LD_LIBRARY_PATH &&
    export TNS_ADMIN=~/Downloads/oracle/instantclient/network/admin:$TNS_ADMIN

    echo "Local Oracle instant client has been setup!"
fi

echo "Local Oracle DB - 21c is ready for use!"