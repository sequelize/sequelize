export default [
  // Replace 'node:crypto' module with a "shim".
  {
    include: [
      // `require()`s.
      './src/dialects/abstract/query.js',
      './src/dialects/abstract/query-generator.js',
      './src/dialects/mssql/query-generator.js',
      './src/dialects/db2/query-generator.js',
      // `import`s.
      './src/utils/dialect.ts',
      './src/dialects/sqlite/query-generator-typescript.ts',
      './src/dialects/sqlite/query-interface.ts',
    ],
    packages: {
      crypto: 'crypto',
      'node:crypto': 'crypto',
    },
  },

  // Replace 'node:util' module with a "shim".
  {
    include: [
      // `require()`s.
      './src/dialects/abstract/query-generator.js',
      './src/dialects/ibmi/query-generator.js',
      './src/model.js',
      './src/instance-validator.js',
      // `import`s.
      './src/geo-json.ts',
      './src/dialects/sqlite/connection-manager.ts',
      './src/model-definition.ts',
      './src/model-internals.ts',
      './src/associations/helpers.ts',
      './src/decorators/legacy/associations.ts',
      './src/dialects/abstract/data-types-utils.ts',
      './src/dialects/abstract/data-types.ts',
      './src/dialects/abstract/query-generator-typescript.ts',
      './src/dialects/abstract/query-generator.js',
      './src/dialects/abstract/query.js',
      './src/dialects/abstract/where-sql-builder.ts',
      './src/dialects/abstract/where-sql-builder.ts',
      './src/utils/deprecations.ts',
      './src/utils/dialect.ts',
      './src/utils/immutability.ts',
      './src/utils/logger.ts',
      './src/utils/string.ts',
      './src/dialects/sqlite/data-types.ts',
      './src/dialects/sqlite/connection-manager.ts',
      // Non-browser dialects (unused):
      './src/dialects/mariadb/query.ts',
      './src/dialects/mysql/query.ts',
      './src/dialects/mysql/query-generator.ts',
      './src/dialects/mssql/data-types.ts',
      './src/dialects/db2/connection-manager.ts',
      './src/dialects/postgres/range.ts',
      './src/dialects/mysql/connection-manager.ts',
    ],
    packages: {
      'node:util': 'util',
    },
  },

  // Replace 'node:buffer' module with a "shim".
  {
    include: [
      // `import`s.
      './src/dialects/abstract/data-types.ts',
    ],
    packages: {
      'node:buffer': 'buffer',
    },
  },

  // Replace 'node:assert' module with a "shim".
  {
    include: [
      // `require()`s.
      './src/model.js',
      // `import`s.
      './src/transaction.ts',
      './src/associations/belongs-to.ts',
      './src/associations/helpers.ts',
      './src/dialects/abstract/query-interface-internal.ts',
      './src/dialects/abstract/query-interface-typescript.ts',
      './src/utils/format.ts',
      // Non-browser dialects (unused):
      './src/dialects/db2/query.ts',
      './src/dialects/postgres/data-types-db.ts',
      './src/dialects/mysql/connection-manager.ts',
      './src/dialects/db2/connection-manager.ts',
      './src/dialects/postgres/connection-manager.ts',
      './src/dialects/postgres/data-types.ts',
    ],
    packages: {
      'node:assert': 'assert',
    },
  },

  // Replace 'node:url' module with a "shim".
  {
    include: [
      // `import`s.
      './src/utils/url.js',
    ],
    packages: {
      'node:url': 'url',
    },
  },

  // Replace 'node:fs' module with a "shim".
  {
    include: [
      // const fs = config.sslcert || config.sslkey || config.sslrootcert ? require('fs') : null
      '../../node_modules/pg-connection-string/index.js',
      // `import`s.
      './src/dialects/sqlite/connection-manager.ts',
    ],
    packages: {
      fs: 'fs',
      'node:fs': 'fs',
    },
  },

  // Replace 'node:path' module with a "shim".
  {
    include: [
      // `import`s.
      './src/dialects/sqlite/connection-manager.ts',
      './src/utils/url.ts',
    ],
    packages: {
      'node:path': 'path',
    },
  },

  // Replace 'node:async_hooks' module with a "shim".
  {
    include: [
      // `import`s.
      './src/sequelize-typescript.ts',
    ],
    packages: {
      'node:async_hooks': 'async_hooks',
    },
  },

  // Replace 'fast-glob' module with a "shim".
  {
    include: [
      // `import`s.
      './src/import-models.ts',
    ],
    packages: {
      'fast-glob': 'fast-glob',
    },
  },
];
