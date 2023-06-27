This pull request is a casual attempt at "bunding" Sequelize for in-browser usage.

The original issue is:
https://github.com/sequelize/sequelize/issues/14654#issuecomment-1609794201

## Install

* Clone the repo: https://github.com/catamphetamine/sequelize/tree/feature/browser

* Run `yarn` in the root folder. It installs the packages.

* Go to the `core` package folder: `cd packages/core`.

* Run `npm run build` there. It creates a server-side build of Sequelize (core) and outputs it in the `lib` folder. The "entry" file is `lib/index.js`.

* Run `npm run build-browser` there. It creates a client-side "bundle" of Sequelize (core) from the server-side build in the `lib` folder, and outputs the results in the `bundle` folder. The file is `bundle/sequelize.min.js`.

* See the console output with the list of issues:

```
./lib/index.js → bundle/sequelize.min.js...
(!) Missing shims for Node.js built-ins
Creating a browser bundle that depends on "node:util", "node:buffer", "node:crypto", "node:assert", "node:async_hooks", "node:path", "node:url", "fs", "path", "os", "util", "stream", "events" and "node:fs". You might need to include https://github.com/FredKSchott/rollup-plugin-polyfill-node
(!) Circular dependencies
lib/expression-builders/attribute.js -> lib/utils/attribute-syntax.js -> lib/expression-builders/attribute.js
lib/utils/check.js -> lib/expression-builders/where.js -> lib/dialects/abstract/where-sql-builder.js -> lib/expression-builders/attribute.js -> lib/utils/attribute-syntax.js -> lib/expression-builders/cast.js -> lib/utils/check.js
lib/expression-builders/where.js -> lib/dialects/abstract/where-sql-builder.js -> lib/expression-builders/attribute.js -> lib/utils/attribute-syntax.js -> lib/expression-builders/cast.js -> lib/expression-builders/where.js
...and 30 more
(!) Missing global variable names
https://rollupjs.org/configuration-options/#output-globals
Use "output.globals" to specify browser global variable names corresponding to external modules:
node:util (guessing "require$$0$1")
node:buffer (guessing "require$$0$2")
node:crypto (guessing "require$$0$3")
node:assert (guessing "require$$0$4")
node:async_hooks (guessing "require$$0$5")
node:path (guessing "require$$0$7")
node:url (guessing "require$$1")
fs (guessing "require$$0$6")
path (guessing "require$$0$8")
os (guessing "require$$2")
util (guessing "require$$0$9")
stream (guessing "require$$0$a")
events (guessing "require$$0$b")
node:fs (guessing "require$$0$c")
(!) Plugin node-resolve: preferring built-in module 'util' over local alternative at 'C:\dev-github\sequelize\node_modules\util\util.js', pass 'preferBuiltins: false' to disable this behavior or 'preferBuiltins: true' to disable this warning
(!) Plugin node-resolve: preferring built-in module 'events' over local alternative at 'C:\dev-github\sequelize\node_modules\events\events.js', pass 'preferBuiltins: false' to disable this behavior or 'preferBuiltins: true' to disable this warning
(!) Mixing named and default exports
https://rollupjs.org/configuration-options/#output-exports
The following entry modules are using named and default exports together:
lib/index.js?commonjs-entry
```

* The Rollup config can be found at `packages/core/build/rollup.config.mjs`. It "shims" some of the server-side packages by replacing them with plaform-agnostic (pure-javascript) ones so that the code could run in a web browser environment.