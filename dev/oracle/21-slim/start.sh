# Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

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

SEQ_WORKSPACE="$PWD"/../../../

if [[ ! -d  "$SEQ_WORKSPACE"/.oracle/ ]]
then
  mkdir "$SEQ_WORKSPACE"/.oracle/
  if [[ $(uname) == 'Linux' ]]
  then
    wget https://download.oracle.com/otn_software/linux/instantclient/217000/instantclient-basic-linux.x64-21.7.0.0.0dbru.zip --no-check-certificate &&
    unzip instantclient-basic-linux.x64-21.7.0.0.0dbru.zip -d "$SEQ_WORKSPACE"/.oracle/ &&
    rm instantclient-basic-linux.x64-21.7.0.0.0dbru.zip &&
    mv "$SEQ_WORKSPACE"/.oracle/instantclient_21_7 "$SEQ_WORKSPACE"/.oracle/instantclient

    echo "Local Oracle instant client on Linux has been setup!"
  elif [[ $(uname) == 'Darwin' ]]
  then
    if [[ ! -d ~/Downloads/instantclient_19_8 ]]
    then
      curl -O https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basic-macos.x64-19.8.0.0.0dbru.dmg &&
      hdiutil mount instantclient-basic-macos.x64-19.8.0.0.0dbru.dmg &&
      /Volumes/instantclient-basic-macos.x64-19.8.0.0.0dbru/install_ic.sh &&
      hdiutil unmount /Volumes/instantclient-basic-macos.x64-19.8.0.0.0dbru &&
      rm instantclient-basic-macos.x64-19.8.0.0.0dbru.dmg &&
      mv ~/Downloads/instantclient_19_8/ "$SEQ_WORKSPACE"/.oracle/instantclient
    else
      cp -rf ~/Downloads/instantclient_19_8/ "$SEQ_WORKSPACE"/.oracle/instantclient
    fi
    ln -s "$SEQ_WORKSPACE"/.oracle/instantclient/libclntsh.dylib "$SEQ_WORKSPACE"/node_modules/oracledb/build/Release/

    echo "Local Oracle instant client on macOS has been setup!"
  else
  # Windows
    curl -O https://download.oracle.com/otn_software/nt/instantclient/216000/instantclient-basic-windows.x64-21.6.0.0.0dbru.zip &&
    unzip instantclient-basic-windows.x64-21.6.0.0.0dbru.zip -d "$SEQ_WORKSPACE"/.oracle/ &&
    rm instantclient-basic-windows.x64-21.6.0.0.0dbru.zip &&
    mv "$SEQ_WORKSPACE"/.oracle/instantclient_21_6/* "$SEQ_WORKSPACE"/node_modules/oracledb/build/Release

    echo "Local Oracle instant client on $(uname) has been setup!"
  fi
fi
echo "Local Oracle DB is ready for use!"
