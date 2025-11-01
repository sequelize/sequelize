# Query Generator Unit Tests

This directory contains unit tests for the Sequelize query generator methods. These tests validate SQL generation across all supported database dialects without requiring database connections.

## Documentation

- **[TESTING_GUIDELINES.md](./TESTING_GUIDELINES.md)** - Comprehensive guidelines for writing consistent and robust query generator tests
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick reference cheat sheet with common patterns and examples
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Information about migrating dialect-specific tests to the core folder

## Key Requirements

1. **TypeScript Only**: All test files must use TypeScript (`.test.ts` extension)
2. **Use `expectsql`**: Primary assertion utility for testing SQL output across dialects
3. **Multi-Dialect Coverage**: Tests should cover all relevant dialects or use `default` expectation
4. **Type Safety**: Proper TypeScript types for all Models and variables
5. **Consistent Structure**: Follow the established patterns documented in guidelines

## Quick Start

### Basic Test

```typescript
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#versionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that returns the database version', () => {
    expectsql(() => queryGenerator.versionQuery(), {
      'mariadb mysql': 'SELECT VERSION() as `version`',
      postgres: 'SHOW SERVER_VERSION',
      mssql: 'SQL SERVER QUERY',
      sqlite3: 'SELECT sqlite_version() as `version`',
      default: 'SELECT VERSION() as [version]',
    });
  });
});
```

### Test with Models

```typescript
import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryGenerator#insertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        username: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  it('generates insert query', () => {
    const { User } = vars;

    expectsql(() => queryGenerator.insertQuery(User.table, { username: 'john' }), {
      default: `INSERT INTO [Users] ([username]) VALUES ('john');`,
    });
  });
});
```

## Running Tests

```bash
# Run all query generator tests
yarn test-unit query-generator

# Run specific test file
yarn test-unit query-generator/version-query.test.ts

# Run with watch mode
yarn test-unit --watch query-generator

# Run with grep pattern
yarn test-unit --grep "versionQuery"
```

## Test Files

This directory contains 38 test files covering various query generator methods:

**DDL Operations:**

- `create-table-query.test.ts`
- `drop-table-query.test.ts`
- `rename-table-query.test.ts`
- `add-column-query.test.ts`
- `remove-column-query.test.ts`
- `describe-table-query.test.ts`
- `table-exists-query.test.ts`

**Constraint Operations:**

- `add-constraint-query.test.ts`
- `remove-constraint-query.test.ts`
- `show-constraints-query.test.ts`
- `set-constraint-checking-query.test.ts`
- `get-constraint-snippet.test.ts`

**Index Operations:**

- `show-indexes-query.test.ts`
- `remove-index-query.test.ts`

**DML Operations:**

- `select-query.test.ts`
- `insert-query.test.ts`
- `update-query.test.ts`
- `bulk-insert-query.test.ts`
- `bulk-delete-query.test.ts`
- `arithmetic-query.test.ts`

**Schema/Database Operations:**

- `create-schema-query.test.ts`
- `drop-schema-query.test.ts`
- `list-schemas-query.test.ts`
- `create-database-query.test.ts`
- `drop-database-query.test.ts`
- `list-databases-query.test.ts`
- `list-tables-query.test.ts`

**Transaction Operations:**

- `start-transaction-query.test.ts`
- `commit-transaction-query.test.ts`
- `rollback-transaction-query.test.ts`
- `set-isolation-level-query.test.ts`
- `create-savepoint-query.test.ts`
- `rollback-savepoint-query.test.ts`

**Utility Operations:**

- `version-query.test.ts`
- `truncate-table-query.test.ts`
- `toggle-foreign-key-checks-query.test.ts`
- `quote-identifier.test.ts`
- `json-path-extraction-query.test.ts`

## Contributing

When adding new query generator methods or updating existing ones:

1. Create or update the corresponding test file
2. Follow the patterns in [TESTING_GUIDELINES.md](./TESTING_GUIDELINES.md)
3. Use TypeScript with proper types
4. Cover all relevant dialects
5. Test both success and error cases
6. Run tests to ensure they pass: `yarn test-unit query-generator`

## Migration from Dialect-Specific Tests

If you're migrating tests from `/packages/core/test/unit/dialects/{dialect}/query-generator.test.js`:

1. Read [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)
2. Identify which methods are being tested
3. Find or create the appropriate test file in this directory
4. Convert JavaScript to TypeScript
5. Refactor to use `expectsql` with multi-dialect expectations
6. Test thoroughly and update documentation

## Support

For help with:

- **Test utilities**: See `packages/core/test/support.ts`
- **Chai extensions**: See `packages/core/test/chai-extensions.d.ts`
- **Project guidelines**: See `/.github/copilot-instructions.md`
- **Contributing**: See `/CONTRIBUTING.md`
