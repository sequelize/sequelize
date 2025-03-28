#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637

sudo mkdir -p /data/hxe
sudo chown 12000:79 /data/hxe
echo '{ "master_password" : "HXEHana1" }' | sudo tee /data/hxe/hxepassword.json
sudo chmod 600 /data/hxe/hxepassword.json
sudo chown 12000:79 /data/hxe/hxepassword.json

docker compose -p sequelize-hana-latest down --remove-orphans
docker compose -p sequelize-hana-latest up -d

./../wait-until-healthy.sh sequelize-hana-latest

DIALECT=hana ../../../node_modules/.bin/ts-node ../../check-connection.ts
