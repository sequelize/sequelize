# Query Generator Unit Testing Guidelines

## Overview

These guidelines establish standards for writing consistent, robust, and maintainable unit tests for query generator methods in the Sequelize core package. These tests validate SQL generation across all supported database dialects.

## File Requirements

### 1. TypeScript Requirement

**All query generator test files MUST be written in TypeScript (`.test.ts` extension).**

- Use proper TypeScript types from `@sequelize/core`
- Leverage type inference where appropriate
- Add type annotations for Model definitions and variables
- Use `@ts-expect-error` comments when intentionally testing invalid options

### 2. File Naming Convention

Test files should be named after the method they test:

```
{method-name}-query.test.ts
```

Examples:

- `version-query.test.ts` → tests `queryGenerator.versionQuery()`
- `create-table-query.test.ts` → tests `queryGenerator.createTableQuery()`
- `insert-query.test.ts` → tests `queryGenerator.insertQuery()`

### 3. File Location

All query generator unit tests are located in:

```
packages/core/test/unit/query-generator/
```

## Test Structure

### Basic Template

```typescript
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#{methodName}', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that [describes the expected behavior]', () => {
    expectsql(() => queryGenerator.methodName(/* args */), {
      default: 'SQL QUERY FOR MOST DIALECTS',
      'mariadb mysql': 'SQL QUERY FOR MYSQL/MARIADB',
      postgres: 'SQL QUERY FOR POSTGRES',
      mssql: 'SQL QUERY FOR SQL SERVER',
      sqlite3: 'SQL QUERY FOR SQLITE',
      snowflake: 'SQL QUERY FOR SNOWFLAKE',
      'db2 ibmi': 'SQL QUERY FOR DB2/IBMI',
    });
  });
});
```

### Template with Model Setup

For tests requiring Model definitions, use `beforeAll2`:

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
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        username: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  it('produces a query for a model', () => {
    const { User } = vars;

    expectsql(
      () =>
        queryGenerator.methodName(User.table, {
          /* options */
        }),
      {
        default: 'SQL QUERY',
      },
    );
  });
});
```

## Core Testing Patterns

### 1. Using `expectsql`

The `expectsql` utility is the primary assertion method. It supports:

#### Basic Usage

```typescript
expectsql(() => queryGenerator.versionQuery(), {
  default: 'SELECT VERSION() as [version]',
  postgres: 'SHOW SERVER_VERSION',
  mssql: 'SQL SERVER SPECIFIC QUERY',
});
```

#### Multi-Dialect Keys

You can specify multiple dialects in a single key:

```typescript
expectsql(() => queryGenerator.someQuery(), {
  'mariadb mysql': 'MYSQL COMPATIBLE QUERY',
  'db2 ibmi': 'DB2/IBMI COMPATIBLE QUERY',
  default: 'ALL OTHER DIALECTS',
});
```

#### Error Expectations

Test that certain inputs throw errors:

```typescript
expectsql(
  () =>
    queryGenerator.addConstraintQuery('myTable', {
      // @ts-expect-error -- Testing invalid type
      type: 'INVALID',
      fields: ['id'],
    }),
  {
    default: new Error('Constraint type INVALID is not supported by ${dialect.name} dialect'),
  },
);
```

#### Function vs Direct Value

- Use `() => queryGenerator.method()` when you want to catch errors
- Use direct calls when errors are not expected (though arrow functions are preferred for consistency)

### 2. Dialect-Specific Error Testing

Define error constants at the top of the file for unsupported features:

```typescript
const dialect = sequelize.dialect;
const notSupportedError = new Error(`Feature X is not supported by ${dialect.name} dialect`);

// In test:
expectsql(() => queryGenerator.methodName(), {
  default: 'QUERY FOR SUPPORTED DIALECTS',
  sqlite3: notSupportedError,
  snowflake: notSupportedError,
});
```

### 3. Dialect Feature Checking

Skip tests or test suites when features are not supported:

```typescript
describe('advanced feature tests', () => {
  // Skip entire suite if feature is not supported
  if (!sequelize.dialect.supports.featureName) {
    return;
  }

  it('tests the feature', () => {
    // test implementation
  });
});
```

Or for individual tests:

```typescript
it('tests dialect-specific behavior', () => {
  // Skip test for unsupported dialects
  if (!dialect.supports.schemas) {
    return;
  }

  expectsql(/* ... */);
});
```

### 4. Schema Testing Patterns

Test schema-related behavior systematically:

```typescript
it('produces a query with schema in tableName object', () => {
  expectsql(() => queryGenerator.methodName({ tableName: 'myTable', schema: 'mySchema' }), {
    default: 'SQL WITH [mySchema].[myTable]',
    'mariadb mysql': 'SQL WITH `mySchema`.`myTable`',
    sqlite3: 'SQL WITH `mySchema.myTable`', // SQLite uses delimiters
  });
});

it('produces a query with default schema', () => {
  expectsql(
    () =>
      queryGenerator.methodName({
        tableName: 'myTable',
        schema: dialect.getDefaultSchema(),
      }),
    {
      default: 'SQL WITH [myTable]', // Default schema should be omitted
    },
  );
});

it('produces a query with globally set schema', () => {
  const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
  const queryGeneratorSchema = sequelizeSchema.queryGenerator;

  expectsql(() => queryGeneratorSchema.methodName('myTable'), {
    default: 'SQL WITH [mySchema].[myTable]',
  });
});
```

### 5. Testing Different Input Types

Test that methods accept various input types (strings, objects, Models, ModelDefinitions):

```typescript
it('produces a query from a table name string', () => {
  expectsql(() => queryGenerator.methodName('myTable'), {
    default: 'SQL QUERY',
  });
});

it('produces a query from a Model', () => {
  const MyModel = sequelize.define('MyModel', {});

  expectsql(() => queryGenerator.methodName(MyModel), {
    default: 'SQL WITH [MyModels]', // Note: uses plural
  });
});

it('produces a query from a ModelDefinition', () => {
  const MyModel = sequelize.define('MyModel', {});
  const myDefinition = MyModel.modelDefinition;

  expectsql(() => queryGenerator.methodName(myDefinition), {
    default: 'SQL WITH [MyModels]',
  });
});

it('produces a query from a TableNameWithSchema object', () => {
  expectsql(() => queryGenerator.methodName({ tableName: 'myTable', schema: 'mySchema' }), {
    default: 'SQL QUERY',
  });
});
```

### 6. Bind Parameter Testing

For methods that support bind parameters, test both query and bind outputs:

```typescript
it('supports named bind parameters', () => {
  const { User } = vars;

  const { query, bind } = queryGenerator.insertQuery(User.table, {
    firstName: 'John',
    lastName: literal('$lastName'),
  });

  expectsql(query, {
    default: 'INSERT INTO [Users] ([firstName],[lastName]) VALUES ($sequelize_1,$lastName);',
  });

  expect(bind).to.deep.eq({
    sequelize_1: 'John',
  });
});

it('parses named replacements in literals', () => {
  const { User } = vars;

  const { query, bind } = queryGenerator.insertQuery(
    User.table,
    { firstName: literal(':name') },
    {},
    { replacements: { name: 'Zoe' } },
  );

  expectsql(query, {
    default: `INSERT INTO [Users] ([firstName]) VALUES ('Zoe');`,
  });

  expect(bind).to.deep.eq({});
});
```

### 7. Testing Options and Edge Cases

Systematically test all options:

```typescript
describe('options', () => {
  it('supports option A', () => {
    expectsql(() => queryGenerator.methodName('myTable', { optionA: true }), {
      default: 'SQL WITH OPTION A',
    });
  });

  it('supports option B', () => {
    expectsql(() => queryGenerator.methodName('myTable', { optionB: 'value' }), {
      default: 'SQL WITH OPTION B',
    });
  });

  it('throws error for invalid option', () => {
    expectsql(
      () =>
        queryGenerator.methodName('myTable', {
          // @ts-expect-error -- Testing invalid option
          invalidOption: true,
        }),
      {
        default: new Error('Invalid option: invalidOption'),
      },
    );
  });
});
```

### 8. Internal Method Testing

When testing internal/private methods, use the test internals API:

```typescript
describe('QueryGeneratorInternal#{internalMethod}', () => {
  const queryGenerator = sequelize.queryGenerator;
  const internals = queryGenerator.__TEST__getInternals();

  it('generates correct snippet', () => {
    expectsql(
      () =>
        internals.getConstraintSnippet('myTable', {
          /* options */
        }),
      {
        default: 'CONSTRAINT SNIPPET',
      },
    );
  });
});
```

## Best Practices

### 1. Test Organization

- Group related tests using nested `describe` blocks
- Use descriptive test names starting with verbs: "produces", "generates", "supports", "throws", "handles"
- Order tests from simple to complex
- Test happy paths before error cases

Example:

```typescript
describe('QueryGenerator#createTableQuery', () => {
  // Basic functionality
  it('produces a query to create a table', () => {
    /* ... */
  });

  // Input variations
  describe('input types', () => {
    it('produces a query from a table name', () => {
      /* ... */
    });
    it('produces a query from a model', () => {
      /* ... */
    });
  });

  // Schema handling
  describe('schema support', () => {
    it('produces a query with schema', () => {
      /* ... */
    });
    it('produces a query with default schema', () => {
      /* ... */
    });
  });

  // Options
  describe('options', () => {
    it('supports option A', () => {
      /* ... */
    });
  });

  // Error cases
  describe('error handling', () => {
    it('throws error for invalid input', () => {
      /* ... */
    });
  });
});
```

### 2. Import Organization

Keep imports organized in this order:

```typescript
// 1. Type imports from @sequelize/core
import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';

// 2. Value imports from @sequelize/core
import { DataTypes, Model, Op } from '@sequelize/core';

// 3. Internal imports (use sparingly, only when necessary)
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';

// 4. Test utilities (always last)
import {
  beforeAll2,
  createSequelizeInstance,
  expectsql,
  getTestDialect,
  sequelize,
} from '../../support';
```

### 3. Variable Naming

- Use `queryGenerator` for the generator instance
- Use `dialect` when accessing dialect properties
- Use `dialectName` when you need the string name
- Use meaningful Model names: `User`, `Project`, `Task`, etc.
- Use `vars` for the return value of `beforeAll2()`

```typescript
const queryGenerator = sequelize.queryGenerator;
const dialect = sequelize.dialect;
const dialectName = getTestDialect();

const vars = beforeAll2(() => {
  const User = sequelize.define(/* ... */);
  return { User };
});
```

### 4. SQL Formatting in Expectations

- Use single quotes for SQL string literals in expectations
- Use backticks for MySQL/MariaDB identifiers
- Use square brackets `[]` for the `default` expectation (will be auto-converted)
- Use double quotes for PostgreSQL, Snowflake, DB2, and IBMi
- Keep multi-line SQL readable by using proper indentation
- No semicolon at the end for IBMi dialect

Example:

```typescript
expectsql(/* ... */, {
  default: 'SELECT [column] FROM [table] WHERE [id] = 123',
  'mariadb mysql': 'SELECT `column` FROM `table` WHERE `id` = 123',
  postgres: 'SELECT "column" FROM "table" WHERE "id" = 123',
  mssql: `SELECT [column] FROM [table] WHERE [id] = 123`,
  sqlite3: 'SELECT `column` FROM `table` WHERE `id` = 123',
});
```

### 5. Testing Edge Cases

Always test:

- Empty/null inputs where applicable
- Boundary values (e.g., offset without limit, limit without offset)
- Special characters in identifiers
- Reserved keywords as identifiers
- Multiple options combinations
- Deprecated options (with `@ts-expect-error`)

### 6. Comments

- Use comments to clarify non-obvious test intentions
- Add `// TODO:` comments for known issues or future improvements
- Use `@ts-expect-error` with explanatory comments for intentional type errors
- Document dialect-specific behavior when it differs significantly

```typescript
// @ts-expect-error -- Testing invalid option type
type: 'INVALID',

// TODO: Add test for array input after #12345 is implemented

// PostgreSQL requires explicit casting for JSON operations
expectsql(/* ... */, {
  postgres: 'SELECT CAST(data AS json) FROM table',
});
```

## Common Pitfalls to Avoid

### ❌ Don't:

1. **Forget TypeScript types**

   ```typescript
   // Bad: No types
   const vars = beforeAll2(() => {
     const User = sequelize.define('User', {
       /* ... */
     });
     return { User };
   });
   ```

2. **Use `.js` extension** - All tests must be `.test.ts`

3. **Mix async patterns inconsistently** - Query generators are synchronous; don't use `async/await`

4. **Forget to test all dialects** - Always include `default` or dialect-specific expectations

5. **Hard-code schema names** - Use `dialect.getDefaultSchema()` for default schema testing

6. **Test implementation details** - Focus on SQL output, not internal state

7. **Create database connections** - These are unit tests; don't connect to real databases

### ✅ Do:

1. **Use proper TypeScript types**

   ```typescript
   // Good: Full type safety
   const vars = beforeAll2(() => {
     interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
       id: CreationOptional<number>;
       username: string;
     }

     const User = sequelize.define<TUser>('User', {
       /* ... */
     });
     return { User };
   });
   ```

2. **Test error conditions** - Use `expectsql` with `Error` expectations

3. **Group related tests** - Use nested `describe` blocks

4. **Test all input variations** - Strings, Models, ModelDefinitions, objects

5. **Document dialect differences** - Add comments explaining why SQL differs

## Example: Complete Test File

```typescript
import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { beforeAll2, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;

describe('QueryGenerator#exampleQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    interface TUser extends Model<InferAttributes<TUser>, InferCreationAttributes<TUser>> {
      id: CreationOptional<number>;
      username: string;
      email: string;
    }

    const User = sequelize.define<TUser>(
      'User',
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        username: DataTypes.STRING,
        email: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  it('produces a basic query', () => {
    expectsql(() => queryGenerator.exampleQuery('myTable'), {
      default: 'SELECT * FROM [myTable]',
      'mariadb mysql': 'SELECT * FROM `myTable`',
      postgres: 'SELECT * FROM "myTable"',
    });
  });

  it('produces a query from a Model', () => {
    const { User } = vars;

    expectsql(() => queryGenerator.exampleQuery(User), {
      default: 'SELECT * FROM [Users]',
    });
  });

  describe('options', () => {
    it('supports the columns option', () => {
      expectsql(() => queryGenerator.exampleQuery('myTable', { columns: ['id', 'name'] }), {
        default: 'SELECT [id], [name] FROM [myTable]',
      });
    });

    it('throws an error for invalid option', () => {
      expectsql(
        () =>
          queryGenerator.exampleQuery('myTable', {
            // @ts-expect-error -- Testing invalid option
            invalidOption: true,
          }),
        {
          default: new Error('Invalid option: invalidOption'),
        },
      );
    });
  });

  describe('schema support', () => {
    // Skip tests if schemas are not supported
    if (!dialect.supports.schemas) {
      return;
    }

    it('produces a query with schema', () => {
      expectsql(() => queryGenerator.exampleQuery({ tableName: 'myTable', schema: 'mySchema' }), {
        default: 'SELECT * FROM [mySchema].[myTable]',
        sqlite3: 'SELECT * FROM `mySchema.myTable`',
      });
    });

    it('omits default schema', () => {
      expectsql(
        () =>
          queryGenerator.exampleQuery({
            tableName: 'myTable',
            schema: dialect.getDefaultSchema(),
          }),
        {
          default: 'SELECT * FROM [myTable]',
        },
      );
    });
  });
});
```

## Migration Checklist

When migrating existing query generator tests from dialects to core:

- [ ] Convert file to TypeScript (`.js` → `.test.ts`)
- [ ] Add proper TypeScript types for all variables
- [ ] Use `beforeAll2` instead of `beforeEach` for Model setup
- [ ] Convert Model definitions to use TypeScript inference types
- [ ] Update imports to use `../../support` path
- [ ] Ensure all dialect expectations are covered
- [ ] Add `default` expectation where appropriate
- [ ] Test error conditions with `Error` expectations
- [ ] Group tests logically with `describe` blocks
- [ ] Add comments for dialect-specific behavior
- [ ] Remove any integration test patterns (database connections, async operations)
- [ ] Verify tests run successfully: `yarn test-unit`

## Running Tests

```bash
# Run all query generator unit tests
yarn test-unit query-generator

# Run specific test file
yarn test-unit query-generator/version-query.test.ts

# Run in watch mode
yarn test-unit --watch query-generator
```

## Additional Resources

- Test utilities: `packages/core/test/support.ts`
- Chai extensions: `packages/core/test/chai-extensions.d.ts`
- Sequelize development docs: `/CONTRIBUTING.md`
- TypeScript configuration: `packages/core/tsconfig.json`
