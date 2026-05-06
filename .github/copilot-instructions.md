# Sequelize AI Development Guide

## Architecture Overview

Sequelize is a monorepo ORM for Node.js supporting 9+ databases. Key architectural patterns:

- **Packages**: Core ORM (`@sequelize/core`) + dialect-specific packages (`@sequelize/postgres`, `@sequelize/mysql`, etc.)
- **Dialect Pattern**: Each database has its own package with `dialect.ts`, `query-generator.js`, `query-interface.js`, and `connection-manager.ts`
- **Model System**: Legacy models use `model.js` with TypeScript definitions, but **all new code should be written in TypeScript**
- **Build System**: Uses esbuild via `build-packages.mjs` to compile TypeScript to both CommonJS and ESM
- **TypeScript Migration**: Project is actively migrating from JavaScript to TypeScript - prefer `.ts` files for all new implementations

## Development Workflow

### Essential Commands

```bash
# Build specific package
node build-packages.mjs core
node build-packages.mjs postgres

# Run tests by dialect
yarn test-integration-postgres
yarn test-unit

# Start local DBs for testing
yarn start-postgres-latest
yarn reset-postgres

# SSCCE (debugging minimal reproductions)
yarn sscce-postgres
```

### Database Testing Setup

- Docker containers in `dev/{dialect}/{latest|oldest}/` with start/stop/reset scripts
- Test config in `packages/core/test/config/config.ts` with environment-based settings
- Integration tests use `Support.createMultiTransactionalTestSequelizeInstance()` for isolation

## Code Patterns

### Dialect Implementation

When adding dialect features:

1. Update `packages/{dialect}/src/dialect.ts` for feature support flags
2. Implement in `query-generator.js` (legacy) or `query-generator.ts` (preferred for new features)
3. Add to `query-interface.js` (legacy) or `query-interface.ts` (preferred) for schema operations
4. **Write all new implementations in TypeScript** - avoid creating new `.js` files
5. TypeScript definitions are co-located with implementation files

### Model Definition Pattern

```javascript
// Core pattern in tests and examples
this.User = sequelize.define('User', {
  field: DataTypes.STRING,
  uniqueField: { type: DataTypes.STRING, unique: true },
});
```

### Testing Conventions

- Use `Support.getTestDialectTeaser()` for dialect-specific test descriptions
- `beforeEach`/`afterEach` with `customSequelize.sync({ force: true })` and `.close()`
- Test files: `.test.js` for integration, `.test.ts` for unit tests
- Chai assertions with custom extensions in `packages/core/test/chai-extensions.d.ts`

### Writing Integration Tests for New Features

```typescript
import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

describe('Model#newFeature', () => {
  // Skip entire suite if feature is not supported
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

      @Attribute(DataTypes.STRING)
      declare name: string | null;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });

    return { User };
  });

  beforeEach(async () => {
    await vars.User.create({ someField: 1, name: 'test' });
  });

  it('works with basic functionality', async () => {
    const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
    await user.newFeature();
    expect(user.someField).to.equal(2);
  });

  it('handles edge cases properly', async () => {
    const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
    await expect(user.newFeature({ invalid: 'option' })).to.be.rejected;
  });

  // Test dialect-specific behavior
  if (sequelize.dialect.name === 'postgres') {
    it('supports postgres-specific functionality', async () => {
      const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user.newFeature({ postgresOption: true });
      expect(user.someField).to.equal(3);
    });
  }

  // Test feature variations
  if (sequelize.dialect.supports.newFeature?.advanced) {
    it('supports advanced newFeature options', async () => {
      const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user.newFeature({ mode: 'advanced' });
      expect(user.someField).to.equal(5);
    });
  }
});
```

### Testing Database Compatibility

- Use `dialect.supports.featureName` checks to skip unsupported tests
- Test against both oldest and latest database versions via Docker containers
- Integration tests should use `Support.createMultiTransactionalTestSequelizeInstance()` for proper isolation
- Unit tests for pure logic, integration tests for database interactions

## File Structure Conventions

### Package Structure

```
packages/{dialect}/
├── src/
│   ├── dialect.ts              # Feature flags & dialect config
│   ├── query-generator.js      # SQL generation logic
│   ├── query-interface.js      # Schema operations
│   ├── connection-manager.ts   # Connection pooling
│   └── index.ts               # Package exports
└── test/                      # Package-specific tests
```

### Core Package Critical Files

- `src/model.js` - Main Model class implementation
- `src/sequelize.js` - Core Sequelize class
- `src/associations/` - Relationship definitions
- `src/data-types.ts` - Type system
- `test/support.ts` - Test utilities and setup

## Integration Points

### Cross-Package Dependencies

- Core package is database-agnostic, dialects extend abstract classes
- `@sequelize/utils` provides shared utilities across packages
- Test support utilities in `packages/core/test/support.ts` used across dialect tests

### Build & Export System

- Dual CommonJS/ESM exports via `exports` field in package.json
- TypeScript compiled to `lib/` directory with both `.d.ts` and `.d.mts` files
- Legacy decorators exported separately as `@sequelize/core/decorators-legacy`

## Common Gotchas

- Always use `dialect.supports.xyz` checks before implementing dialect-specific features
- Integration tests require database containers - use dev scripts to start them
- Model methods use `.js` files with separate TypeScript definitions
- When modifying query generation, update both the base class and dialect-specific implementations
- **Prefer TypeScript for all new code** - only modify existing `.js` files when necessary
