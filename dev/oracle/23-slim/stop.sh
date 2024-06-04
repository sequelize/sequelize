# Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

#!/usr/bin/env bash
set -Eeuxo pipefail # https://vaneyckt.io/posts/safer_bash_scripts_with_set_euxo_pipefail/
cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" # https://stackoverflow.com/a/17744637


docker-compose -p oraclexedb down --remove-orphans

echo "Local Oracle DB instance stopped (if it was running)."
