#!/usr/bin/env bash

if [ "$#" -ne 1 ]; then
  >&2 echo "Please provide the container name or hash"
  exit 1
fi

for _ in {1..10}
do
  state=$(docker inspect -f '{{ .State.Health.Status }}' $1 2>&1)
  return_code=$?
  if [ ${return_code} -eq 0 ] && [ "$state" == "healthy" ]; then
    echo "$1 is healthy!"
    sleep 15
    exit 0
  fi
  sleep 15
done

>&2 echo "Timeout of 150s exceeded when waiting for container to be healthy: $1"
exit 1
