#!/usr/bin/env bash

if [ "$#" -ne 1 ]; then
  >&2 echo "Please provide the container name or hash"
  exit 1
fi

for _ in {1..240}
do
  state=$(docker inspect -f '{{ .State.Health.Status }}' $1 2>&1)
  return_code=$?
  if [ ${return_code} -eq 0 ] && [ "$state" == "healthy" ]; then
    echo "$1 is healthy!"
    exit 0
  fi
  sleep 1
done

>&2 echo "Timeout of 240s exceeded when waiting for container to be healthy: $1"
exit 1
