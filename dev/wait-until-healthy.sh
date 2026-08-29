#!/usr/bin/env bash
set -uo pipefail

if [ "$#" -ne 1 ]; then
  >&2 echo "Please provide the container name or hash"
  exit 1
fi

container=$1
timeout=${HEALTHCHECK_TIMEOUT:-180}
deadline=$((SECONDS + timeout))
failure=""
reported=""

while [ -z "$failure" ]; do
  if ! state=$(docker inspect -f '{{ .State.Status }}' "$container" 2>/dev/null); then
    >&2 echo "No such container: $container"
    exit 1
  fi

  if [ "$state" == "exited" ] || [ "$state" == "dead" ]; then
    failure="Container $container $state before it became healthy"
    break
  fi

  # the container can still go away between the two inspections
  if ! health=$(docker inspect -f '{{ if .State.Health }}{{ .State.Health.Status }}{{ else }}none{{ end }}' "$container" 2>/dev/null); then
    >&2 echo "No such container: $container"
    exit 1
  fi

  if [ "$health" == "none" ]; then
    >&2 echo "Container $container has no healthcheck to wait for"
    exit 1
  fi

  if [ "$health" == "healthy" ]; then
    echo "$container is healthy!"
    exit 0
  fi

  if [ $SECONDS -ge $deadline ]; then
    failure="Timeout of ${timeout}s exceeded when waiting for container to be healthy: $container (last state: $health)"
    break
  fi

  # only on change, so CI logs get two lines instead of one per second
  if [ "$health" != "$reported" ]; then
    echo "waiting for $container to become healthy (currently: $health)"
    reported=$health
  fi

  sleep 1
done

>&2 echo "$failure"
>&2 echo "--- healthcheck probes ---"
>&2 docker inspect -f '{{ json .State.Health }}' "$container" 2>&1
>&2 echo "--- container logs ---"
>&2 docker logs --tail 50 "$container" 2>&1
exit 1
