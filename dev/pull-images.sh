#!/usr/bin/env bash
# Pulls the images of a docker compose project, retrying on transient registry errors.
# Docker Hub occasionally answers a pull with "500 Internal Server Error", which
# otherwise fails the whole CI job within seconds of it starting.
set -uo pipefail

if [ "$#" -ne 1 ]; then
  >&2 echo "Please provide the docker compose project name"
  exit 1
fi

project=$1
attempts=${PULL_ATTEMPTS:-3}

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if docker compose -p "$project" pull --quiet; then
    exit 0
  fi

  if [ "$attempt" -lt "$attempts" ]; then
    delay=$((15 * attempt))
    >&2 echo "Pulling images for $project failed (attempt $attempt of $attempts), retrying in ${delay}s"
    sleep "$delay"
  fi
done

>&2 echo "Pulling images for $project failed after $attempts attempts"
exit 1
