# Upgrade to v7

Sequelize v7 is the next major release after v6. Below is a list of breaking changes to help you upgrade.

## Breaking Changes

### Support for Node 12 and up

Sequelize v7 will only support those versions of Node.js that are compatible with the ES module specification, namingly version 12 and upwards [#5](https://github.com/sequelize/meetings/issues/5).

### TypeScript conversion

One of the major foundational code changes of v7 is the migration to TypeScript. As a result, the manual typings that were formerly best-effort guesses on top of the JavaScript code base, have been removed and all typings are now directly retrieved from the actual TypeScript code. You'll likely find many tiny differences which however should be easy to fix.
