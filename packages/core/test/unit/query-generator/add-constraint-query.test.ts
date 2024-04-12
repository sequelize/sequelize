import { Deferrable, Op } from '@sequelize/core';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(
  `Add constraint queries are not supported by ${dialect.name} dialect`,
);
const checkNotSupportedError = new Error(
  `Check constraints are not supported by ${dialect.name} dialect`,
);
const defaultNotSupportedError = new Error(
  `Default constraints are not supported by ${dialect.name} dialect`,
);
const deferrableNotSupportedError = new Error(
  `Deferrable constraints are not supported by ${dialect.name} dialect`,
);
const onUpdateNotSupportedError = new Error(
  `Foreign key constraint with onUpdate is not supported by ${dialect.name} dialect`,
);

describe('QueryGenerator#addConstraintQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('throws an error if invalid type', () => {
    expectsql(
      () => {
        return queryGenerator.addConstraintQuery('myTable', {
          // @ts-expect-error -- We're testing invalid options
          type: 'miss-typed',
          fields: ['otherId'],
        });
      },
      {
        default: new Error(
          `Constraint type miss-typed is not supported by ${dialect.name} dialect`,
        ),
        sqlite3: notSupportedError,
      },
    );
  });

  describe('CHECK constraints', () => {
    it('generates a query that adds a check constraint with a name', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'check',
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'ALTER TABLE [myTable] ADD CONSTRAINT [check] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint with an array of values', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'check',
            type: 'CHECK',
            fields: ['role'],
            where: { age: ['admin', 'user', 'guest'] },
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [check] CHECK ([age] IN ('admin', 'user', 'guest'))`,
          mssql: `ALTER TABLE [myTable] ADD CONSTRAINT [check] CHECK ([age] IN (N'admin', N'user', N'guest'))`,
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(MyModel, {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(myDefinition, {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint with schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          default:
            'ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint with default schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          default: 'ALTER TABLE [myTable] ADD CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addConstraintQuery('myTable', {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default:
            'ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          sqlite3: notSupportedError,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a query that adds a check constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          sqlite3: notSupportedError,
        },
      );
    });
  });

  describe('DEFAULT constraints', () => {
    it('generates a query that adds a default constraint with a name', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'default',
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [myTable] ADD CONSTRAINT [default] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(MyModel, {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(myDefinition, {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint with schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint with default schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addConstraintQuery('myTable', {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a default constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          sqlite3: notSupportedError,
        },
      );
    });
  });

  describe('UNIQUE constraints', () => {
    it('generates a query that adds a unique constraint with a name', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'unique',
            type: 'UNIQUE',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [unique] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a deferred unique constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['username'],
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          sqlite3: notSupportedError,
          'postgres snowflake': `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_uk] UNIQUE ([username]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a query that adds a unique constraint with multiple columns', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['first_name', 'last_name'],
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_first_name_last_name_uk] UNIQUE ([first_name], [last_name])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () => queryGenerator.addConstraintQuery(MyModel, { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(myDefinition, { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint with schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint with unique schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addConstraintQuery('myTable', {
            type: 'UNIQUE',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a unique constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          sqlite3: notSupportedError,
        },
      );
    });
  });

  describe('FOREIGN KEY constraints', () => {
    it('generates a query that adds a foreign key constraint with a name', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'foreign key',
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [foreign key] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a deferred foreign key constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          sqlite3: notSupportedError,
          'postgres snowflake': `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a query that adds a composite foreign key constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId', 'someId'],
            references: { table: 'otherTable', fields: ['id', 'someId'] },
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_someId_otherTable_fk] FOREIGN KEY ([otherId], [someId]) REFERENCES [otherTable] ([id], [someId])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with on delete', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            onDelete: 'CASCADE',
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) ON DELETE CASCADE`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with on update', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            onUpdate: 'CASCADE',
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) ON UPDATE CASCADE`,
          sqlite3: notSupportedError,
          'db2 ibmi': onUpdateNotSupportedError,
        },
      );
    });

    it('throws an error if no references is defined', () => {
      expectsql(
        () => {
          // @ts-expect-error -- We're testing invalid options
          return queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
          });
        },
        {
          default: new Error(
            'Invalid foreign key constraint options. `references` object with `table` and `field` must be specified',
          ),
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});
      const OtherModel = sequelize.define('OtherModel', {});

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(MyModel, {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: OtherModel, field: 'id' },
          }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_otherId_OtherModels_fk] FOREIGN KEY ([otherId]) REFERENCES [OtherModels] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;
      const OtherModel = sequelize.define('OtherModel', {});
      const otherDefinition = OtherModel.modelDefinition;

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(myDefinition, {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: otherDefinition, field: 'id' },
          }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_otherId_OtherModels_fk] FOREIGN KEY ([otherId]) REFERENCES [OtherModels] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              type: 'FOREIGN KEY',
              fields: ['otherId'],
              references: { table: { tableName: 'otherTable', schema: 'mySchema' }, field: 'id' },
            },
          ),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [mySchema].[otherTable] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with foreign key schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            {
              type: 'FOREIGN KEY',
              fields: ['otherId'],
              references: {
                table: { tableName: 'otherTable', schema: dialect.getDefaultSchema() },
                field: 'id',
              },
            },
          ),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addConstraintQuery('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [mySchema].[otherTable] ([id])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a foreign key constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            {
              type: 'FOREIGN KEY',
              fields: ['otherId'],
              references: {
                table: { tableName: 'otherTable', schema: 'mySchema', delimiter: 'custom' },
                field: 'id',
              },
            },
          ),
        {
          sqlite3: notSupportedError,
        },
      );
    });
  });

  describe('PRIMARY KEY constraints', () => {
    it('generates a query that adds a primary key constraint with a name', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            name: 'primary key',
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [primary key] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a deferred primary key constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['username'],
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          sqlite3: notSupportedError,
          'postgres snowflake': `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a query that adds a primary key constraint with multiple columns', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['first_name', 'last_name'],
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_first_name_last_name_pk] PRIMARY KEY ([first_name], [last_name])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(MyModel, { type: 'PRIMARY KEY', fields: ['username'] }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(myDefinition, {
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [MyModels] ADD CONSTRAINT [MyModels_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint with schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint with primary key schema', () => {
      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          default: `ALTER TABLE [myTable] ADD CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addConstraintQuery('myTable', {
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `ALTER TABLE [mySchema].[myTable] ADD CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
          sqlite3: notSupportedError,
        },
      );
    });

    it('generates a query that adds a primary key constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          queryGenerator.addConstraintQuery(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          sqlite3: notSupportedError,
        },
      );
    });
  });
});
