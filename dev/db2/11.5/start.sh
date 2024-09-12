cd dev/db2/11.5
export DIALECT=db2

mkdir -p Docker
if [ ! "$(sudo docker ps -q -f name=db2server)" ]; then
    if [ "$(sudo docker ps -aq -f status=exited -f name=db2server)" ]; 
	then
    # cleanup
    sudo docker rm -f db2server
		sudo rm -rf /Docker
	fi
	sudo docker run -h db2server --name db2server --restart=always --detach --privileged=true -p 50000:50000 --env-file .env_list -v /Docker:/database ibmcom/db2-amd64:11.5.6.0a
	count=1
	while true
	do
	  if (sudo docker logs db2server | grep 'Setup has completed')
	  then	  
		sudo docker exec db2server bash -c "su db2inst1 & disown"
		break
	  fi
	  if ($count -gt 30); then
		echo "Error: Db2 docker setup has not completed in 10 minutes."
		break
	  fi
	  sleep 20
	  let "count=count+1"
	done
  echo "Local DB2-11.5 instance is ready for Sequelize tests."
fi
