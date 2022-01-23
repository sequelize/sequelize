# Upgrade to v7

Sequelize v7 is the next major release after v6. Below is a list of breaking changes to help you upgrade.

## Breaking Changes

### Support for Node 12 and up

Sequelize v7 will only support those versions of Node.js that are compatible with the ES module specification,
namingly version 12 and upwards [#5](https://github.com/sequelize/meetings/issues/5).

### TypeScript conversion

One of the major foundational code changes of v7 is the migration to TypeScript.
As a result, the manual typings that were formerly best-effort guesses on top of the JavaScript code base,
have been removed and all typings are now directly retrieved from the actual TypeScript code.
You'll likely find many tiny differences which however should be easy to fix.

## Attributes cannot start and end with `$`, or include `.`

`$attribute$` & `$nested.attribute$` is a special syntax used to reference nested attributes in Queries.
The `.` character also has special meaning, being used to reference nested JSON object keys,
the `$nested.attribute$` syntax, and in output names of eager-loaded associations in SQL queries.

In Sequelize 6, it was possible to create an attribute that matched this special syntax, leading to subtle bugs.
Starting with Sequelize 7, this is now considered reserved syntax, and it is no longer possible to
use a string that both starts and ends with a `$` as the attribute name, or includes the `.` character.

This only affects the attribute name, it is still possible to do this for the column name.

### Changes to `ConnectionManager`

*This only impacts you if you used `ConnectionManager` directly.*

`ConnectionManager#getConnection`: The `type` option now accepts `'read' | 'write'` instead of `'SELECT' | any`.
It was already documented as such in v6, but the implementation did not match the documentation.

```typescript
// Instead of doing this:
sequelize.connectionManager.getConnection({ type: 'SELECT' });

// Do this:
sequelize.connectionManager.getConnection({ type: 'read' });
```
