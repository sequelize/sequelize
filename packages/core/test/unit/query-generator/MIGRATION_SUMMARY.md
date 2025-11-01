# Query Generator Test Migration Summary

## Identified Test Files

### ✅ Core Query Generator Tests (Already in Correct Location)

**Location:** `/packages/core/test/unit/query-generator/`

These 38 test files are already in TypeScript and follow the new structure:

- `add-column-query.test.ts`
- `add-constraint-query.test.ts`
- `arithmetic-query.test.ts`
- `bulk-delete-query.test.ts`
- `bulk-insert-query.test.ts`
- `commit-transaction-query.test.ts`
- `create-database-query.test.ts`
- `create-savepoint-query.test.ts`
- `create-schema-query.test.ts`
- `create-table-query.test.ts`
- `describe-table-query.test.ts`
- `drop-database-query.test.ts`
- `drop-schema-query.test.ts`
- `drop-table-query.test.ts`
- `get-constraint-snippet.test.ts`
- `insert-query.test.ts`
- `json-path-extraction-query.test.ts`
- `list-databases-query.test.ts`
- `list-schemas-query.test.ts`
- `list-tables-query.test.ts`
- `quote-identifier.test.ts`
- `remove-column-query.test.ts`
- `remove-constraint-query.test.ts`
- `remove-index-query.test.ts`
- `rename-table-query.test.ts`
- `rollback-savepoint-query.test.ts`
- `rollback-transaction-query.test.ts`
- `select-query.test.ts`
- `set-constraint-checking-query.test.ts`
- `set-isolation-level-query.test.ts`
- `show-constraints-query.test.ts`
- `show-indexes-query.test.ts`
- `start-transaction-query.test.ts`
- `table-exists-query.test.ts`
- `toggle-foreign-key-checks-query.test.ts`
- `truncate-table-query.test.ts`
- `update-query.test.ts`
- `version-query.test.ts`

**Status:** ✅ These files are well-structured and follow the guidelines.

### 🔄 Dialect-Specific Tests (To Be Migrated)

**Location:** `/packages/core/test/unit/dialects/{dialect}/query-generator.test.js`

These are the files that need to be migrated to the core folder structure:

1. **db2** - `/packages/core/test/unit/dialects/db2/query-generator.test.js`
2. **mariadb** - `/packages/core/test/unit/dialects/mariadb/query-generator.test.js`
3. **mssql** - `/packages/core/test/unit/dialects/mssql/query-generator.test.js`
4. **mysql** - `/packages/core/test/unit/dialects/mysql/query-generator.test.js`
5. **postgres** - `/packages/core/test/unit/dialects/postgres/query-generator.test.js`
6. **sqlite** - `/packages/core/test/unit/dialects/sqlite/query-generator.test.js`
7. **snowflake** - `/packages/core/test/unit/dialects/snowflake/query-generator.test.js`

**Status:** ⚠️ These files need to be:

- Reviewed for any dialect-specific test coverage
- Content migrated to appropriate files in `/query-generator/` folder
- Converted from JavaScript to TypeScript
- Refactored to use the `expectsql` pattern with multi-dialect expectations
- Removed or deprecated once migration is complete

## Migration Strategy

### Phase 1: Analysis

For each dialect-specific test file:

1. Read the entire file to understand what methods are being tested
2. Identify which tests are truly dialect-specific vs. general tests
3. Map each test to an existing or new file in `/query-generator/`

### Phase 2: Migration

For each test in dialect files:

#### Option A: General Test (applies to all/most dialects)

1. Find or create the appropriate method test file in `/query-generator/`
2. Add the test with multi-dialect expectations using `expectsql`
3. Include the dialect-specific SQL in the expectation map

Example:

```typescript
// Original postgres-only test
it('generates RETURNING clause', () => {
  expect(query).to.equal('INSERT INTO "users" DEFAULT VALUES RETURNING *');
});

// Migrated to insert-query.test.ts
it('generates RETURNING clause for dialects that support it', () => {
  expectsql(() => queryGenerator.insertQuery(/* ... */), {
    default: 'INSERT INTO [users] DEFAULT VALUES',
    postgres: 'INSERT INTO "users" DEFAULT VALUES RETURNING *',
    sqlite3: 'INSERT INTO `users` DEFAULT VALUES RETURNING *',
    mssql: 'INSERT INTO [users] DEFAULT VALUES OUTPUT INSERTED.*',
  });
});
```

#### Option B: Truly Dialect-Specific Test

If a test is truly specific to one dialect and doesn't make sense for others:

1. Keep it in a dialect-specific file (if necessary)
2. Or use dialect feature checking:

```typescript
describe('PostgreSQL-specific features', () => {
  if (sequelize.dialect.name !== 'postgres') {
    return;
  }

  it('supports PostgreSQL-specific syntax', () => {
    expectsql(() => queryGenerator.postgresSpecificMethod(), {
      postgres: 'POSTGRES SPECIFIC SQL',
    });
  });
});
```

### Phase 3: Verification

1. Run all tests to ensure coverage is maintained: `yarn test-unit`
2. Check that no functionality is lost
3. Verify TypeScript types are correct
4. Remove or deprecate old dialect-specific test files

## Key Differences in Patterns

### Old Pattern (Dialect-Specific Files)

```javascript
// In packages/core/test/unit/dialects/postgres/query-generator.test.js
describe('[POSTGRES Specific] QueryGenerator', () => {
  const suites = {
    attributesToSQL: [
      {
        arguments: [{ id: 'INTEGER' }],
        expectation: { id: 'INTEGER' },
      },
    ],
  };

  each(suites, (tests, suiteTitle) => {
    describe(suiteTitle, () => {
      for (const test of tests) {
        const content = test.arguments.map(arg => util.inspect(arg)).join(', ');
        it(content, function () {
          const queryGenerator = new QueryGenerator(/* ... */);
          expect(queryGenerator[suiteTitle](...test.arguments)).to.deep.equal(test.expectation);
        });
      }
    });
  });
});
```

### New Pattern (Core with Multi-Dialect Support)

```typescript
// In packages/core/test/unit/query-generator/attribute-to-sql.test.ts
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#attributesToSQL', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('converts INTEGER type', () => {
    expectsql(() => queryGenerator.attributesToSQL({ id: 'INTEGER' }), {
      default: { id: 'INTEGER' },
    });
  });

  it('converts INTEGER with NOT NULL constraint', () => {
    expectsql(() => queryGenerator.attributesToSQL({ id: { type: 'INTEGER', allowNull: false } }), {
      default: { id: 'INTEGER NOT NULL' },
    });
  });

  it('generates SERIAL for auto-increment primary keys', () => {
    expectsql(
      () =>
        queryGenerator.attributesToSQL({
          id: { type: 'INTEGER', primaryKey: true, autoIncrement: true },
        }),
      {
        default: { id: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
        postgres: { id: 'INTEGER SERIAL PRIMARY KEY' },
        'mariadb mysql': { id: 'INTEGER PRIMARY KEY AUTO_INCREMENT' },
      },
    );
  });
});
```

## Benefits of Migration

1. **Better TypeScript Support**: Full type safety and autocomplete
2. **Unified Testing**: All query generators tested in one place
3. **Dialect Comparison**: Easy to see differences between dialects
4. **Reduced Duplication**: Shared test setup and utilities
5. **Easier Maintenance**: Changes to query generators only require updating one test file
6. **Comprehensive Coverage**: Ensures all dialects are tested for each method

## Next Steps

1. **Review** the existing core tests in `/query-generator/` to understand the patterns
2. **Follow** the `TESTING_GUIDELINES.md` for all new/migrated tests
3. **Start** with one dialect-specific file and migrate it incrementally
4. **Test** thoroughly after each migration
5. **Document** any dialect-specific quirks or limitations
6. **Clean up** old test files once migration is confirmed working

## Questions to Consider During Migration

- [ ] Is this test testing the correct query generator method?
- [ ] Does this test apply to multiple dialects or just one?
- [ ] Are there already tests for this method in the core folder?
- [ ] What are the dialect-specific differences in SQL output?
- [ ] Does the dialect support this feature? (Check `dialect.supports`)
- [ ] Are there edge cases that need additional test coverage?
- [ ] Can this test be combined with existing tests?
- [ ] Does this test need Model setup or can it use simple arguments?

## Example Migration

**Before:** Postgres-specific test

```javascript
// packages/core/test/unit/dialects/postgres/query-generator.test.js
it('generates correct ILIKE query', function () {
  const sql = queryGenerator.whereQuery({ name: { [Op.iLike]: 'John%' } });
  expect(sql).to.equal(`WHERE "name" ILIKE 'John%'`);
});
```

**After:** Core test with multi-dialect support

```typescript
// packages/core/test/unit/query-generator/where-query.test.ts
describe('case-insensitive matching', () => {
  it('supports case-insensitive LIKE with Op.iLike', () => {
    // Only PostgreSQL natively supports ILIKE
    if (sequelize.dialect.name !== 'postgres') {
      return;
    }

    expectsql(() => queryGenerator.whereQuery({ name: { [Op.iLike]: 'John%' } }), {
      postgres: `WHERE "name" ILIKE 'John%'`,
    });
  });
});
```

Or if other dialects should handle it differently:

```typescript
it('supports case-insensitive matching', () => {
  expectsql(() => queryGenerator.whereQuery({ name: { [Op.iLike]: 'John%' } }), {
    postgres: `WHERE "name" ILIKE 'John%'`,
    default: `WHERE LOWER([name]) LIKE LOWER('John%')`, // Fallback implementation
  });
});
```
