set -e

rimraf esdoc

exec 5>&1
OUT=$(esdoc -c docs/esdoc-config.js|tee /dev/fd/5)

cp docs/favicon.ico esdoc/favicon.ico
cp docs/ROUTER.txt esdoc/ROUTER

node docs/run-docs-transforms.js
node docs/redirects/create-redirects.js

rimraf esdoc/file esdoc/source.html

set +e
GREP_RESULT=$(echo "$OUT" | grep -c 'could not parse the following code\|SyntaxError')
set -e

if [ "$GREP_RESULT" -ge 1 ]; then
  echo "esdoc generation encountered an error. See above logging for details."
  exit 1
fi
