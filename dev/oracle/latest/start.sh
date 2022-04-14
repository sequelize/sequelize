#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

# Remove an existing Oracle DB docker image
docker-compose -p oraclexedb down --remove-orphans

# Bring up new Oracle DB docker image
docker-compose -p oraclexedb up -d

# Wait until Oracle DB is set up and docker state is healthy
./wait-until-healthy.sh oraclexedb

# Moving privileges.sql to docker container
docker cp privileges.sql oraclexedb:/opt/oracle/. 

# Granting all the needed privileges to sequelizetest user
docker exec -t oraclexedb sqlplus system/password@XEPDB1 @privileges.sql

# Setting up Oracle instant client for oracledb
if [ ! -d  ~/oracle ] && [ $(uname) == 'Linux' ]
then 
    mkdir ~/oracle && 
    wget https://download.oracle.com/otn_software/linux/instantclient/215000/instantclient-basic-linux.x64-21.5.0.0.0dbru.zip --no-check-certificate && 
    unzip instantclient-basic-linux.x64-21.5.0.0.0dbru.zip -d ~/oracle/ &&
    rm instantclient-basic-linux.x64-21.5.0.0.0dbru.zip &&
    mv ~/oracle/instantclient_21_5 ~/oracle/instantclient

    echo "Local Oracle instant client has been setup!"
elif [ ! -d  ~/Downloads/oracle ] && [ $(uname) == 'Darwin' ]
then
    mkdir ~/oracle && 
    wget https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basic-macos.x64-19.8.0.0.0dbru.zip --no-check-certificate && 
    unzip instantclient-basic-macos.x64-19.8.0.0.0dbru.zip -d ~/oracle/ &&
    rm instantclient-basic-macos.x64-19.8.0.0.0dbru.zip &&
    mv ~/oracle/instantclient_19_8 ~/oracle/instantclient

    echo "Local Oracle instant client has been setup!"
fi

echo "Local Oracle DB is ready for use!"