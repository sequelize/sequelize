# AGENTS.md

Guidance for AI coding agents working in this repository. This is the only agent instruction file here; keep agent guidance in it rather than adding tool-specific copies. `CLAUDE.md` imports this file. Human contributor documentation lives in [CONTRIBUTING.md](CONTRIBUTING.md).

## Setup and build

```bash
node --version          # must be 22, 24, or 26; prefer 24, which CI uses for lint and typings
yarn install --immutable
yarn build              # Nx-cached; cheap when nothing changed
node build-packages.mjs core   # build a single package
yarn nx reset           # only if Nx caching misbehaves
```

- Tests import packages through their built `lib/` output. **Rebuild after every source change or branch switch before running tests**, or the tests exercise stale code.
- Install builds the native addons `sqlite3`, `ibm_db`, `odbc`, and `oracledb`, so a working native toolchain is required. On macOS, importing `@sequelize/db2-ibmi` also needs a system `unixODBC` providing `libodbc.2.dylib`.
- Do not assume a Node version outside 22/24/26 works because package metadata allows it; the native connectors are only tested on those lines.
- Dialect and utility packages **generate `src/index.ts`** from their export map. After adding or removing an export, run `yarn sync-exports` in that package, and never hand-edit a file whose header reads `Generated File, do not modify directly`.
- `@sequelize/core` and `@sequelize/validator.js` have no `sync-exports` script. Their `src/index.mjs` is hand-written and must be updated by hand when exports change; the only thing that catches a miss is `yarn test-unit-esm`, and no CI job runs `test-exports`.

## Test

```bash
yarn test:format                                              # eslint + prettier (check); `yarn format` autofixes
yarn test-typings
yarn lerna run test-sqlite3                                   # documented baseline
yarn lerna run test-integration-sqlite3 --scope=@sequelize/core   # lightest DB-backed path
yarn lerna run test-unit-postgres --scope=@sequelize/core      # one dialect
yarn lerna run test-unit --scope=@sequelize/postgres           # dialect package's own tests

cd packages/core && DIALECT=sqlite3 yarn mocha test/integration/utils.test.ts   # single file
```

- Non-SQLite integration tests need the matching database. Start one with `yarn start-<dialect>-oldest` or `yarn start-<dialect>-latest` (Docker; definitions in `dev/<dialect>/{oldest,latest}`), stop with `yarn stop-<dialect>`, and wipe containers and volumes with `yarn reset-<dialect>`. Only mariadb, mysql, postgres, mssql, db2 and oracle have these scripts; snowflake and ibmi need an external server.
- CI runs oldest and latest for mariadb, mysql, postgres, db2 and oracle. mssql is latest-only (the oldest job is disabled at `ci.yml:300`), and snowflake and ibmi have no integration CI at all — only unit tests, so a regression there is not caught for you.
- `yarn test-unit` starts with `test/esm-named-exports.test.js`, which imports every published package. `packages/core/test/config/config.ts` also imports every dialect package, so even SQLite-scoped core tests need every connector installed. A failure here is usually a missing local prerequisite, not a code defect — confirm which before changing source.
- `yarn sscce-sqlite3` (or `yarn sscce-<dialect>`) is the quickest end-to-end smoke check after a build.

## Project map

- Yarn 4 + Lerna monorepo. Use Yarn for all dependency and workspace tasks; the repo relies on Yarn workspaces and patches.
- `packages/core` — the dialect-agnostic ORM and most cross-dialect tests.
- `packages/{postgres,mysql,mariadb,sqlite3,mssql,db2,ibmi,oracle,snowflake}` — dialect connectors.
- `packages/{utils,validator-js,cli}` — separately published packages with their own build and test scripts.
- Edit `packages/*/src`. `packages/*/lib` is build output; never hand-edit it.
- `build-packages.mjs` is the build entry point, invoked by `yarn build` / `lerna run build`.

## Architecture

- Dialect packages extend the abstract classes in `packages/core/src/abstract-dialect`: `dialect.ts`, `query-generator.js` (with `query-generator-typescript.ts`), `query-interface.js` (with `query-interface-typescript.ts`), `query.ts`, and `connection-manager.ts`.
- Each dialect mirrors that layout in `packages/<dialect>/src`: `dialect.ts` declares support flags, `query-generator.js` builds SQL, `query-interface.js` implements schema operations, `query.js` executes and maps results, and `connection-manager.ts` wraps the driver. The TypeScript migration is uneven — `sqlite3`, `ibmi` and `snowflake` already have a `query-interface.ts`, and dialect-side TypeScript halves are named `*.internal.ts`. Check the files before assuming.
- The codebase is migrating from JavaScript to TypeScript. Legacy `.js` classes extend a TypeScript counterpart (`Model extends ModelTypeScript`, `AbstractQueryGenerator extends AbstractQueryGeneratorTypeScript`) with a co-located `.d.ts`. Add new methods to the TypeScript class (`*-typescript.ts` or `*.internal.ts`) and write every new file in TypeScript, rather than extending the legacy `.js` file.
- Legacy `.js` sources have hand-written `.d.ts` files beside them. The build copies these verbatim rather than generating them, so nothing catches a `.d.ts` that has drifted from its implementation — update both together.
- Files to know: `packages/core/src/model.js`, `sequelize.js`, `associations/`, `data-types.ts`, `abstract-dialect/`. `@sequelize/utils` holds shared helpers.
- When changing query generation, update the abstract implementation in core and check every dialect override — do not generalise from one dialect.
- Packages publish dual CommonJS/ESM builds through `exports`: `lib/` carries `.js`/`.d.ts` and `.mjs`/`.d.mts`. `@sequelize/core/decorators-legacy` is a separate subpath export.

## Testing conventions

- Every bug fix and new feature needs an automated regression test that fails without the change.
- Put the test where the behaviour lives. Behaviour that is not dialect-specific belongs in `packages/core/test` so it runs against every dialect; only genuinely dialect-specific tests belong in `packages/<dialect>/src/*.test.ts`. Prefer one shared test over per-dialect copies.
- Use unit tests for pure logic and integration tests when the behaviour depends on real database semantics.
- Mocha picks up `*.test.js` and `*.test.ts` under `packages/core/test/{unit,integration}`. Write new tests in TypeScript.
- Integration tests import from `packages/core/test/integration/support.ts`: `sequelize` (the shared instance for the current `DIALECT`), `beforeAll2` (runs setup once, returns its result to every test), and `setResetMode('drop' | 'truncate' | 'destroy' | 'none')`. **`drop` is the default and unregisters every model after each test**, so a suite that defines its models once in `beforeAll2` — like the example below — must call `setResetMode('destroy')` or `'truncate'`, or every test after the first fails.
- Unit tests import from `packages/core/test/support.ts`; `expectsql` asserts generated SQL per dialect. Chai assertions use the extensions in `packages/core/test/chai-extensions.d.ts`.
- Guard dialect-specific tests with `sequelize.dialect.supports.<feature>`. Adding a capability flag is three edits: the type in `DialectSupports` (`packages/core/src/abstract-dialect/dialect.ts:47`), the default in the `freezeDeep` block (`:337`), and an `AbstractDialect.extendSupport()` call in each dialect that overrides it. Prefer that over branching on `sequelize.dialect.name`.

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

  beforeEach(async () => {
    await vars.User.create({ someField: 1 });
  });

  it('works', async () => {
    const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
    await user.newFeature();
    expect(user.someField).to.equal(2);
  });
});
```

## Branching and PRs

- Target `main`. `v6` is an exceptional target, only when agreed with maintainers.
- PR titles follow the repository's conventional commit scheme — `docs`, `feat`, `fix`, or `meta`, optionally scoped: `fix(postgres): ...`.
- Update documentation when a public API or user-visible behaviour changes.
- `THREAT_MODEL.md` is a living document; update it when a security-relevant trust boundary, documented invariant, or security-relevant default materially changes.

## Security analysis

- Read [THREAT_MODEL.md](THREAT_MODEL.md) before triaging or escalating any suspected vulnerability, and [SECURITY.md](SECURITY.md) before reporting one.
- **If a finding may be a Sequelize vulnerability, it and every PoC, regression test, and technical detail must stay private.** Report it through the advisory process in [SECURITY.md](SECURITY.md); never open a public issue or pull request containing them. Findings that only document application misuse or hardening guidance may be raised publicly.
- Do not treat unusual behaviour as a security issue without a concrete attacker-controlled input, a reachable code path, and a plausible impact. For every finding, identify the input, the source-to-sink path, the violated invariant or threat scenario, and the maximum realistic impact.
- Check whether an existing issue, advisory, or documented behaviour already covers it before reporting.
- Treat a finding as sufficiently evidenced only when it has a PoC meeting the standards below.
- State every element `THREAT_MODEL.md` §9 requires. Do not assign a disposition or severity yourself: maintainers decide both when they assess the report.
- Prefer invalidating a weak finding over preserving a speculative one.

## Security PoC standards

- Write the PoC as a regression test in the package that owns the behaviour, using the existing harness and fixtures.
- Assert the secure behaviour, not the vulnerable implementation detail: the test must fail on vulnerable code and pass unchanged after the fix.
- Start from a reachable public API or another trust-boundary endpoint available to the relevant actor. An internal-helper test does not prove exploitability.
- Exercise the reported root cause with realistic attacker-controlled input and a trusted application configuration. Do not substitute a different trigger or tweak inputs only to make the test fail.
- Keep PoCs short, self-contained, and readable. They may use the repository's documented test services, including the Docker database services above, but must not depend on machine-local files or manual configuration beyond the documented prerequisites.
- Report the narrowest command that runs the PoC, with its real output showing the failing assertion or the concrete blocker.
- If no reachable PoC can exercise the claimed root cause, report that concrete reason instead of writing a substitute test, and leave disposition to the reviewing operator.
