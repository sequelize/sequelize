#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

mkdir -p Docker
if [ ! "$(sudo docker ps -q -f name=sequelize-db2-oldest)" ]; then
    if [ "$(sudo docker ps -aq -f status=exited -f name=sequelize-db2-oldest)" ];
	then
    # cleanup
    docker compose -p sequelize-db2-oldest down --remove-orphans
		sudo rm -rf /Docker
	fi
	docker compose -p sequelize-db2-oldest up -d
	count=1
	while true
	do
	  if (sudo docker logs sequelize-db2-oldest | grep 'Setup has completed')
	  then
		sudo docker exec sequelize-db2-oldest bash -c "su db2inst1 & disown"
		break
	  fi
	  if [ $count -gt 30 ]; then
		echo "Error: Db2 docker setup has not completed in 10 minutes."
		break
	  fi
	  sleep 20
	  let "count=count+1"
	done
fi

DIALECT=db2 ts-node ../../check-connection.ts
