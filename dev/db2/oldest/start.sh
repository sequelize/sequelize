#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

export DIALECT=db2
SEQ_DB="${SEQ_DB:-testdb}"
# db2 db names must be uppercase
SEQ_DB=$(echo "$SEQ_DB" | awk '{print toupper($0)}')

mkdir -p Docker
if [ ! "$(sudo docker ps -q -f name=db2server)" ]; then
    if [ "$(sudo docker ps -aq -f status=exited -f name=db2server)" ];
	then
    # cleanup
    sudo docker rm -f db2server
		sudo rm -rf /Docker
	fi
	sudo docker run -h db2server --name db2server --restart=always --detach --privileged=true -p 50000:50000 --env "DBNAME=$SEQ_DB" --env-file ../.env_list -v /Docker:/database ibmcom/db2-amd64:11.5.6.0a
	count=1
	while true
	do
	  if (sudo docker logs db2server | grep 'Setup has completed')
	  then
		sudo docker exec db2server bash -c "su db2inst1 & disown"
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
