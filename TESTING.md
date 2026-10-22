# Writing tests for Sequelize

This document describes how tests in this repository should be written. For setting up databases and running the test suites, see [CONTRIBUTING.md](CONTRIBUTING.md#4-running-tests).

Many existing tests, mostly the `.js` files under `packages/core/test`, predate these conventions and are being migrated. Do not copy their style: follow this document for every new test, and when you substantially change a legacy test file, consider converting it (see [Converting a legacy test file](#converting-a-legacy-test-file)).

## Where tests live

| Package                     | Location                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `@sequelize/core`           | `packages/core/test/unit/**/*.test.ts` and `packages/core/test/integration/**/*.test.ts`               |
| Dialect-specific behaviour  | `packages/core/test/unit/dialects/<dialect>/` and `packages/core/test/integration/dialects/<dialect>/` |
| Dialect package internals   | Next to the source, in `packages/<dialect>/src/**/*.test.ts`                                           |
| `@sequelize/validator.js`   | `packages/validator-js/test/**/*.test.ts`                                                              |
| `@sequelize/utils`          | `__tests__` directories next to the source, in `packages/utils/src/**/__tests__/*.test.ts`             |
| `@sequelize/cli`            | Next to the source, in `packages/cli/src/**/*.test.ts`                                                 |
| Typings (`@sequelize/core`) | `packages/core/test/types/**/*.ts`, checked by `yarn test-typings` and never executed                  |

- Put the test where the behaviour lives. Behaviour that is not dialect-specific belongs in `packages/core/test`, so it runs against every dialect. Prefer one shared test over per-dialect copies.
- Genuinely dialect-specific tests also go in `packages/core/test`, under `unit/dialects/<dialect>/` or `integration/dialects/<dialect>/`, where the database configuration and the helpers below are available.
- Tests next to the source of a dialect package (`packages/<dialect>/src/**/*.test.ts`) run without a database and without the core test helpers, so they are only suitable for that package's internals. `@sequelize/oracle`, `@sequelize/db2-ibmi` and `@sequelize/snowflake` have no script that runs such tests.
- Use **unit tests** for logic that does not need a database, such as SQL generation, option validation and model definition. Unit tests never connect to a database.
- Use **integration tests** when the behaviour depends on what the database actually does.
- Every bug fix and new feature needs at least one test that fails without the change.

## General style

- Write new tests in **TypeScript**. Do not add new `.test.js` files.
- Use arrow functions for `describe`, `it` and hooks. Do not use Mocha's `this` context to share state (`this.sequelize`, `this.User = …`). Use the helpers described below instead.
- Name each suite after what it tests: `Class.staticMethod` or `Class#instanceMethod`, such as `describe('Model.findAll')`, `describe('Model#restore')` or `describe('QueryGenerator#removeColumnQuery')`. `Support.getTestDialectTeaser()` is legacy; don't use it in new suites.
- Keep suites flat. Nest a `describe` only to group tests that share a fixture or setup, not to wrap a single test, to scope one stub, or to hold a dialect check.
- Import `sequelize` from the support file and use it under that name. Don't alias it (`const current = sequelize`).
- Use Chai's `expect` (`import { expect } from 'chai'`). In `@sequelize/core` tests, [`packages/core/test/support.ts`](packages/core/test/support.ts) registers [chai-as-promised](https://www.npmjs.com/package/chai-as-promised), [sinon-chai](https://www.npmjs.com/package/sinon-chai), [chai-datetime](https://www.npmjs.com/package/chai-datetime) and the custom assertions declared in [`packages/core/test/chai-extensions.d.ts`](packages/core/test/chai-extensions.d.ts). Import from the support file in every test file that uses them: otherwise the file passes in the full run, where another file loaded the support file first, and fails when it runs alone. Tests in other packages only have plain Chai.
- Every assertion must be able to fail:
  - Always `await` promise assertions: `await expect(promise).to.be.rejectedWith(…)`. An assertion that isn't awaited never fails its own test; at best, the run crashes later with an unhandled rejection.
  - Specify what you expect to be thrown. Bare `.to.be.rejected` or `.to.throw()` also passes when the code fails for an unrelated reason. Pass the most specific error class, a message, or both. The base `Error` class is almost as weak as passing nothing.
  - Never end a test early with `return` because the dialect does not support something. The test then passes without checking anything. See [Dialect differences](#dialect-differences).
- Create Sinon stubs and spies in the test that uses them, and restore them in an `afterEach(() => { sinon.restore(); })`. Nothing restores them automatically.
- A stub that a whole suite shares through `beforeAll2` must be restored in `after`, with `stub.restore()`, because `sinon.restore()` in an `afterEach` would remove it after the first test. Don't combine the two in the same suite, including nested suites, or create the shared stub from its own `sinon.createSandbox()`.
- Use `useFakeTimers()` from the support file rather than `sinon.useFakeTimers()`: it leaves `process.nextTick` and `queueMicrotask` alone, which the database drivers need. `sinon.restore()` also restores the clock.
- Mocha does not type-check tests: they are transpiled without type checking. `yarn test-typings` does, against the built `lib/` declarations, so run it before pushing, and rebuild first if you changed any public type. The tests of `@sequelize/validator.js` are not type-checked.
- Mark intentionally invalid input with `// @ts-expect-error -- <reason>` rather than casting to `any`. When the typings reject something the runtime supports, fix the typings, or link the issue that tracks the gap in the comment.

## Helpers

Unit tests import from [`packages/core/test/support.ts`](packages/core/test/support.ts). Integration tests import from [`packages/core/test/integration/support.ts`](packages/core/test/integration/support.ts), which re-exports everything in the unit support file and adds the database-reset machinery.

| Helper                                       | Purpose                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sequelize`                                  | The shared Sequelize instance for the dialect selected by the `DIALECT` environment variable.                                                                                                                                                                               |
| `beforeAll2(cb)` / `beforeEach2(cb)`         | Like `before` / `beforeEach`, but return an object that holds whatever `cb` last returned. Use it to share models and other fixtures. The object is filled in when the hook runs, so read `vars.X` inside hooks and tests, and never destructure it in the `describe` body. |
| `setResetMode(mode)`                         | Integration only. Controls how the database is reset between the tests of a suite. See below.                                                                                                                                                                               |
| `createSingleTestSequelizeInstance(options)` | Integration only. Creates an instance with custom options that is closed after the current test. Only call it inside a test.                                                                                                                                                |
| `createSequelizeInstance(options)`           | Creates an instance with custom options. In integration tests, create it in a hook and close it in the matching `after` or `afterEach`. Unit tests never connect, so they can create one anywhere and don't close it.                                                       |
| `expectsql(fn, expectations)`                | Asserts generated SQL, or a thrown error, per dialect.                                                                                                                                                                                                                      |
| `expectPerDialect(fn, expectations)`         | Like `expectsql`, but for any value, compared with deep equality. If `fn` is async, `expectPerDialect` returns a promise that must be awaited.                                                                                                                              |
| `allowDeprecationsInSuite(codes)`            | Allows the listed deprecation codes in the current suite. Any other deprecation warning fails the run.                                                                                                                                                                      |

Node.js emits each deprecation warning only once per process. A suite that triggers a deprecation without allowing it can therefore pass in the full run, because another file triggered it first, and fail when its file runs alone. Call `allowDeprecationsInSuite` in every suite that triggers the deprecation.

### Resetting the database

After each integration test, the database is reset according to the mode set with `setResetMode`:

- `drop` (the default): drops every table, enum and non-default schema, **and unregisters every model**.
- `destroy`: deletes every row from the tables of the registered models, which also runs their bulk destroy hooks. Identity columns are not reset. Models stay registered.
- `truncate`: truncates the tables of the registered models. Whether identity columns restart depends on the dialect. On dialects that can neither cascade a truncate nor disable foreign key checks, truncating a table that a foreign key references fails. Models stay registered.
- `none`: does nothing.

The reset applies to every open Sequelize instance, not only the shared one. Whatever the mode, the database is dropped completely once the suite ends.

Define a suite's models once, in `beforeAll2`, and call `setResetMode('destroy')`. Use `truncate` only for suites whose models have no foreign keys between them. With the default `drop` mode, the models defined in `beforeAll2` are gone after the first test, and every following test fails. Use `beforeEach2` only when each test really needs fresh models.

- Rows are deleted after each test in every mode except `none`. Create them in the test or in a `beforeEach`, not in `beforeAll2`, unless the suite uses `setResetMode('none')` and none of its tests write.
- With `destroy` and `truncate`, don't rely on generated primary key values such as `1`; use the instances the test created.

Unit tests don't reset anything: models defined in one unit test file stay registered on the shared instance for the files that run after it.

## Defining models

- For models shared by a suite, declare a class with typed attributes and decorators from `@sequelize/core/decorators-legacy`, inside `beforeAll2`, and register it with `sequelize.addModels()`. This gives you typed models and a typed `vars` object.
- A model used by a single test can be created inside that test with `sequelize.define()`.
- When a test is about a specific way of defining models (`sequelize.define`, `Model.init`, decorators), use that API.
- Define associations with decorators on class-based models. Call the association methods (`User.hasMany(…)`) when the test is about those methods or their options.

## Dialect differences

### Unsupported features

Decide whether a test applies to the current dialect **when the test is registered, not while it runs**. Wrap the `describe` or `it` in a condition, or return early from the `describe` callback:

```typescript
describe('Model#newFeature', () => {
  if (!sequelize.dialect.supports.newFeature) {
    return;
  }

  // …
});
```

- Base the condition on the `sequelize.dialect.supports` flags rather than on `sequelize.dialect.name`, so the test follows the dialect's declared capabilities. Adding a capability flag takes three edits: the type in `DialectSupports` (`packages/core/src/abstract-dialect/dialect.ts`), its default in the `freezeDeep` block of the same file, and, in each dialect that supports the feature, the key in the existing `AbstractDialect.extendSupport()` call in its `src/dialect.ts`.
- Branch on the dialect name only for genuinely dialect-specific behaviour that no flag describes.
- Some capabilities depend on the database server version, which is only known once connected. Check them in a `before` hook written as a regular function, and call `this.skip()` there. This is the one exception to the arrow function rule, along with `this.timeout()`.
- If unsupported dialects have a defined behaviour, such as throwing a specific error, assert that behaviour instead of leaving the test out. `expectsql` and `expectPerDialect` accept an `Error` as an expectation for this. Only the message is compared: the expectation passes when its message appears in the thrown error's message or in one of its causes, whatever the error class. Always give a specific, non-empty message, as an empty one matches any error.

### Different results per dialect

When a result legitimately differs between dialects, list the expected value per dialect rather than writing `if`/`else` chains inside the test:

```typescript
expectsql(() => queryGenerator.removeColumnQuery('myTable', 'myColumn', { cascade: true }), {
  default: buildInvalidOptionReceivedError('removeColumnQuery', dialectName, ['cascade']),
  'db2 ibmi postgres': 'ALTER TABLE [myTable] DROP COLUMN [myColumn] CASCADE',
  sqlite3: notSupportedError,
});
```

- Keys are `default` or a space-separated list of up to four dialect names. The `default` expectation is used for every dialect without its own entry.
- In `expectsql`, write identifiers between `[` and `]` in expectations shared by several dialects (`default` or a key listing several dialects). They are replaced by the dialect's own quote characters, except in `ARRAY[…]`, and a trailing `;` is removed for `ibmi`. Expectations for a single dialect are used as written. In all cases, insignificant whitespace is ignored.
- `expectPerDialect` compares values as written. To compare SQL with it, use `toMatchSql()`, which replaces `[` and `]` in the `default` expectation only, or in every expectation with `toMatchSql(sql, { genericQuotes: true })`.

## Unit tests for SQL generation

Test each query generator method in its own file in `packages/core/test/unit/query-generator/`, with one `expectsql` call per case covering every dialect. The per-dialect `packages/core/test/unit/dialects/*/query-generator.test.js` files are legacy. Don't add cases to them; move their cases into the shared files.

## Example

An integration test in `packages/core/test/integration/model/new-feature.test.ts`:

```typescript
import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

describe('Model#newFeature', () => {
  if (!sequelize.dialect.supports.newFeature) {
    return;
  }

  setResetMode('destroy');

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare someField: number;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });

    return { User };
  });

  it('works', async () => {
    const user = await vars.User.create({ someField: 1 });
    await user.newFeature();
    expect(user.someField).to.equal(2);
  });
});
```

## Converting a legacy test file

When converting a `.js` test file to TypeScript:

1. Rename it to `.test.ts` and replace `require` calls with `import`s.
2. Replace `this.sequelize` and aliases such as `const current = Support.sequelize` with the imported `sequelize`, and state stored on `this` with `beforeAll2` / `beforeEach2`. Arrow functions then replace `function () {}`.
3. If the models no longer need to be recreated before every test, move them to `beforeAll2` and set an appropriate reset mode.
4. Replace `describe(Support.getTestDialectTeaser('X'), () => { describe('y', …) })` with a single suite named after what it tests, such as `describe('Model.y', …)`, and flatten describes that no longer group anything.
5. Move dialect checks that `return` inside a test to where the test is registered.
6. Run `yarn test-typings`. Type errors are often the first sign of a test that does not test what it claims, such as an option name with a typo.
7. Fix assertions that cannot fail (see [General style](#general-style)) and list them in the pull request description.
8. Compare the number of tests per dialect before and after the conversion. Every difference must come from a dialect check moved to registration time, which removes the test from that dialect's count. Any other difference means a test was lost.

Keeping `sequelize.define()` while converting is fine. Converting models to classes is welcome but not required, and keeping the diff close to the original makes the conversion easier to review.
