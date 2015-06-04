#!/bin/sh -e

export COOKIES='cookies.txt'
export USER_AGENT='Mozilla/5.0'

cd "$(dirname "$(readlink -f "$0")")"

echo > "$COOKIES"
chmod 600 "$COOKIES"

phantomjs --ssl-protocol=tlsv1 download.js | head -n 1 |
curl --cookie "$COOKIES" --cookie-jar "$COOKIES" --data '@-' \
  --location --output "$ORACLE_FILE" --user-agent "$USER_AGENT" \
  'https://login.oracle.com/oam/server/sso/auth_cred_submit'

