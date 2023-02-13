#!/usr/bin/env bash

set -x -e -u -o pipefail

docker pull ibmcom/db2
docker run --name db2 -itd --privileged=true -p 50000-50001:50000-50001 -e LICENSE=accept -e DB2INST1_PASSWORD=db2inst1 -e DBNAME=testdb --net sequelize_default -v $HOME/database:/database ibmcom/db2
docker ps -as
docker exec -it db2 useradd -ms /bin/bash auth_user -p auth_pass

count=1
while true
do
  if (docker logs db2 | grep 'Setup has completed')
  then
      break
  fi
  if ($count -gt 30); then
    echo "Error: Db2 docker setup has not completed in 10 minutes."
    break
  fi

  sleep 20
  let "count=count+1"
done

