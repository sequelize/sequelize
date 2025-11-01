# Query Generator Test Quick Reference

## File Template

```typescript
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#{methodName}', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('describes what the test does', () => {
    expectsql(() => queryGenerator.methodName(/* args */), {
      default: 'SQL QUERY',
    });
  });
});
```

## With Model Setup

```typescript
import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryGenerator#{methodName}', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
      id: CreationOptional<number>;
      username: string;
    }

    const User = sequelize.define<TUser>(
      'User',
      {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        username: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  it('works with models', () => {
    const { User } = vars;
    expectsql(() => queryGenerator.methodName(User), {
      default: 'SQL QUERY',
    });
  });
});
```

## Common Imports

```typescript
// Types
import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from '@sequelize/core';

// Core
import { DataTypes, Deferrable, IndexHints, literal, Model, Op, TableHints } from '@sequelize/core';

// Test utilities
import {
  beforeAll2,
  createSequelizeInstance,
  expectsql,
  getTestDialect,
  sequelize,
} from '../../support';

// Chai
import { expect } from 'chai';
```

## Dialect Keys Reference

```typescript
expectsql(/* ... */, {
  default: 'SQL FOR MOST DIALECTS',           // Converted to dialect-specific quotes
  'mariadb mysql': 'SQL FOR MYSQL/MARIADB',   // Both MySQL and MariaDB
  postgres: 'SQL FOR POSTGRESQL',              // PostgreSQL only
  mssql: 'SQL FOR SQL SERVER',                 // SQL Server only
  sqlite3: 'SQL FOR SQLITE',                   // SQLite only
  snowflake: 'SQL FOR SNOWFLAKE',             // Snowflake only
  db2: 'SQL FOR DB2',                          // DB2 only
  ibmi: 'SQL FOR IBM i',                       // IBM i only
  'db2 ibmi': 'SQL FOR DB2 AND IBM i',        // Both DB2 and IBM i
});
```

## Quote Characters by Dialect

| Dialect       | Identifier Quotes | String Quotes |
| ------------- | ----------------- | ------------- |
| Default       | `[` `]`           | `'`           |
| MySQL/MariaDB | `` ` ``           | `'`           |
| PostgreSQL    | `"`               | `'`           |
| SQL Server    | `[` `]`           | `'` or `N'`   |
| SQLite        | `` ` ``           | `'`           |
| Snowflake     | `"`               | `'`           |
| DB2           | `"`               | `'`           |
| IBM i         | `"`               | `'`           |

## Testing Patterns Cheat Sheet

### Error Testing

```typescript
expectsql(() => queryGenerator.method(invalidInput), {
  default: new Error('Expected error message'),
});
```

### Schema Testing

```typescript
// With schema
expectsql(() => queryGenerator.method({ tableName: 'table', schema: 'mySchema' }), {
  default: '[mySchema].[table]',
});

// Default schema (should be omitted)
expectsql(
  () =>
    queryGenerator.method({
      tableName: 'table',
      schema: dialect.getDefaultSchema(),
    }),
  {
    default: '[table]',
  },
);
```

### Dialect Feature Check

```typescript
if (!sequelize.dialect.supports.featureName) {
  return; // Skip test
}

// Or for entire suite
describe('feature tests', () => {
  if (!sequelize.dialect.supports.featureName) {
    return;
  }

  it('tests feature', () => {
    /* ... */
  });
});
```

### Bind Parameters

```typescript
const { query, bind } = queryGenerator.method(/* ... */);

expectsql(query, {
  default: 'SQL WITH $sequelize_1',
});

expect(bind).to.deep.eq({
  sequelize_1: 'value',
});
```

### Multiple Input Types

```typescript
it('accepts table name string', () => {
  expectsql(() => queryGenerator.method('myTable'), {
    /* ... */
  });
});

it('accepts Model', () => {
  const MyModel = sequelize.define('MyModel', {});
  expectsql(() => queryGenerator.method(MyModel), {
    /* ... */
  });
});

it('accepts ModelDefinition', () => {
  const MyModel = sequelize.define('MyModel', {});
  expectsql(() => queryGenerator.method(MyModel.modelDefinition), {
    /* ... */
  });
});

it('accepts table object', () => {
  expectsql(() => queryGenerator.method({ tableName: 'myTable' }), {
    /* ... */
  });
});
```

## Test Structure Pattern

```typescript
describe('QueryGenerator#methodName', () => {
  const queryGenerator = sequelize.queryGenerator;

  // Setup (if needed)
  const vars = beforeAll2(() => {
    /* ... */
  });

  // Basic functionality
  it('produces a basic query', () => {
    /* ... */
  });

  // Input variations
  describe('input types', () => {
    it('accepts string input', () => {
      /* ... */
    });
    it('accepts Model input', () => {
      /* ... */
    });
  });

  // Schema support
  describe('schema support', () => {
    it('includes schema when provided', () => {
      /* ... */
    });
    it('omits default schema', () => {
      /* ... */
    });
  });

  // Options
  describe('options', () => {
    it('supports option A', () => {
      /* ... */
    });
    it('supports option B', () => {
      /* ... */
    });
  });

  // Dialect-specific
  describe('dialect-specific behavior', () => {
    if (sequelize.dialect.name === 'postgres') {
      it('supports PostgreSQL feature', () => {
        /* ... */
      });
    }
  });

  // Error cases
  describe('error handling', () => {
    it('throws error for invalid input', () => {
      /* ... */
    });
  });
});
```

## Common Variables

```typescript
const queryGenerator = sequelize.queryGenerator;
const dialect = sequelize.dialect;
const dialectName = getTestDialect();
const internals = queryGenerator.__TEST__getInternals(); // For internal methods

// Error constants
const notSupportedError = new Error(`Feature is not supported by ${dialect.name} dialect`);
```

## TypeScript Model Definition

```typescript
const vars = beforeAll2(() => {
  // Define interface
  interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
    id: CreationOptional<number>; // Auto-generated fields
    username: string; // Required fields
    email: string | null; // Nullable fields
    createdAt: CreationOptional<Date>; // Timestamps
  }

  // Define model with interface
  const User = sequelize.define<TUser>(
    'User',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: DataTypes.STRING, // Nullable by default
    },
    { timestamps: true },
  );

  return { User };
});
```

## Running Tests

```bash
# All query generator tests
yarn test-unit query-generator

# Specific file
yarn test-unit query-generator/version-query.test.ts

# Watch mode
yarn test-unit --watch query-generator

# With grep pattern
yarn test-unit --grep "versionQuery"
```

## Common Mistakes

### ❌ Wrong

```typescript
// JavaScript extension
// version-query.test.js

// Missing types
const User = sequelize.define('User', {});

// Direct call (won't catch errors)
expectsql(queryGenerator.method(), { /* ... */ });

// Hardcoded schema
schema: 'public'

// Missing default expectation
expectsql(/* ... */, {
  postgres: 'SQL',
  mysql: 'SQL',
  // Missing other dialects!
});
```

### ✅ Correct

```typescript
// TypeScript extension
// version-query.test.ts

// With proper types
interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
  id: CreationOptional<number>;
}
const User = sequelize.define<TUser>('User', { /* ... */ });

// Arrow function (catches errors)
expectsql(() => queryGenerator.method(), { /* ... */ });

// Use dialect method
schema: dialect.getDefaultSchema()

// Include default or all dialects
expectsql(/* ... */, {
  default: 'SQL FOR MOST',
  postgres: 'SQL FOR POSTGRES',
});
```

## Documentation Comments

```typescript
// @ts-expect-error -- Testing invalid option
invalidOption: true;

// TODO: Add test for X after #12345 is merged

// PostgreSQL requires explicit casting for JSON operations
postgres: 'CAST(data AS json)';

// Skip test for dialects without schema support
if (!dialect.supports.schemas) {
  return;
}
```

## Resources

- Full Guidelines: `TESTING_GUIDELINES.md`
- Migration Guide: `MIGRATION_SUMMARY.md`
- Test Support: `packages/core/test/support.ts`
- Example Tests: Any file in `packages/core/test/unit/query-generator/`
