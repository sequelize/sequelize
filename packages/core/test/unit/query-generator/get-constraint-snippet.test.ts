import { Deferrable, Op } from '@sequelize/core';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
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

describe('QueryGeneratorInternal#getConstraintSnippet', () => {
  const queryGenerator = sequelize.queryGenerator;
  const internals = queryGenerator.__TEST__getInternals();

  it('throws an error if invalid type', () => {
    expectsql(
      // @ts-expect-error -- We're testing invalid options
      () => internals.getConstraintSnippet('myTable', { type: 'miss-typed', fields: ['otherId'] }),
      {
        default: new Error(
          `Constraint type miss-typed is not supported by ${dialect.name} dialect`,
        ),
      },
    );
  });

  it('throws an error if field.attribute is used', () => {
    expectsql(
      () =>
        internals.getConstraintSnippet('myTable', {
          type: 'UNIQUE',
          fields: [{ attribute: 'otherId', name: 'otherId' }],
        }),
      {
        default: new Error(
          'The field.attribute property has been removed. Use the field.name property instead',
        ),
      },
    );
  });

  describe('CHECK constraints', () => {
    it('generates a constraint snippet for a check constraint with a name', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'check',
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'CONSTRAINT [check] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint with an array of values', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'check',
            type: 'CHECK',
            fields: ['role'],
            where: { age: ['admin', 'user', 'guest'] },
          }),
        {
          default: `CONSTRAINT [check] CHECK ([age] IN ('admin', 'user', 'guest'))`,
          mssql: `CONSTRAINT [check] CHECK ([age] IN (N'admin', N'user', N'guest'))`,
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          internals.getConstraintSnippet(MyModel, {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'CONSTRAINT [MyModels_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          internals.getConstraintSnippet(myDefinition, {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'CONSTRAINT [MyModels_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint with schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          default: 'CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint with default schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          default: 'CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const internalsSchema = sequelizeSchema.queryGenerator.__TEST__getInternals();

      expectsql(
        () =>
          internalsSchema.getConstraintSnippet('myTable', {
            type: 'CHECK',
            fields: ['age'],
            where: { age: { [Op.gte]: 10 } },
          }),
        {
          default: 'CONSTRAINT [myTable_age_ck] CHECK ([age] >= 10)',
          snowflake: checkNotSupportedError,
        },
      );
    });

    it('generates a constraint snippet for a check constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'CHECK', fields: ['age'], where: { age: { [Op.gte]: 10 } } },
          ),
        {
          sqlite3: 'CONSTRAINT `myTable_age_ck` CHECK (`age` >= 10)',
        },
      );
    });
  });

  describe('DEFAULT constraints', () => {
    it('generates a constraint snippet for a default constraint with a name', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'default',
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [default] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          internals.getConstraintSnippet(MyModel, {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [MyModels_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          internals.getConstraintSnippet(myDefinition, {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [MyModels_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint with schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint with default schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const internalsSchema = sequelizeSchema.queryGenerator.__TEST__getInternals();

      expectsql(
        () =>
          internalsSchema.getConstraintSnippet('myTable', {
            type: 'DEFAULT',
            fields: ['role'],
            defaultValue: 'guest',
          }),
        {
          default: defaultNotSupportedError,
          mssql: `CONSTRAINT [myTable_role_df] DEFAULT (N'guest') FOR [role]`,
        },
      );
    });

    it('generates a constraint snippet for a default constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'DEFAULT', fields: ['role'], defaultValue: 'guest' },
          ),
        {
          sqlite3: defaultNotSupportedError,
        },
      );
    });
  });

  describe('UNIQUE constraints', () => {
    it('generates a constraint snippet for a unique constraint with a name', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'unique',
            type: 'UNIQUE',
            fields: ['username'],
          }),
        {
          default: `CONSTRAINT [unique] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a deferred unique constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'UNIQUE',
            fields: ['username'],
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          'postgres snowflake': `CONSTRAINT [myTable_username_uk] UNIQUE ([username]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint with multiple columns', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'UNIQUE',
            fields: ['first_name', 'last_name'],
          }),
        {
          default: `CONSTRAINT [myTable_first_name_last_name_uk] UNIQUE ([first_name], [last_name])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint', () => {
      expectsql(
        () => internals.getConstraintSnippet('myTable', { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () => internals.getConstraintSnippet(MyModel, { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `CONSTRAINT [MyModels_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          internals.getConstraintSnippet(myDefinition, { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `CONSTRAINT [MyModels_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint with schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          default: `CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint with unique schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          default: `CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const internalsSchema = sequelizeSchema.queryGenerator.__TEST__getInternals();

      expectsql(
        () =>
          internalsSchema.getConstraintSnippet('myTable', { type: 'UNIQUE', fields: ['username'] }),
        {
          default: `CONSTRAINT [myTable_username_uk] UNIQUE ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a unique constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'UNIQUE', fields: ['username'] },
          ),
        {
          sqlite3: 'CONSTRAINT `myTable_username_uk` UNIQUE (`username`)',
        },
      );
    });
  });

  describe('FOREIGN KEY constraints', () => {
    it('generates a constraint snippet for a foreign key constraint with a name', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'foreign key',
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `CONSTRAINT [foreign key] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
        },
      );
    });

    it('generates a constraint snippet for a deferred foreign key constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          'postgres snowflake': `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a constraint snippet for a composite foreign key constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId', 'someId'],
            references: { table: 'otherTable', fields: ['id', 'someId'] },
          }),
        {
          default: `CONSTRAINT [myTable_otherId_someId_otherTable_fk] FOREIGN KEY ([otherId], [someId]) REFERENCES [otherTable] ([id], [someId])`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with on delete', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            onDelete: 'CASCADE',
          }),
        {
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) ON DELETE CASCADE`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with on update', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
            onUpdate: 'CASCADE',
          }),
        {
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id]) ON UPDATE CASCADE`,
          'db2 ibmi': onUpdateNotSupportedError,
        },
      );
    });

    it('throws an error if no references is defined', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', { type: 'FOREIGN KEY', fields: ['otherId'] }),
        {
          default: new Error(
            'Invalid foreign key constraint options. `references` object with `table` and `field` must be specified',
          ),
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});
      const OtherModel = sequelize.define('OtherModel', {});

      expectsql(
        () =>
          internals.getConstraintSnippet(MyModel, {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: OtherModel, field: 'id' },
          }),
        {
          default: `CONSTRAINT [MyModels_otherId_OtherModels_fk] FOREIGN KEY ([otherId]) REFERENCES [OtherModels] ([id])`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;
      const OtherModel = sequelize.define('OtherModel', {});
      const otherDefinition = OtherModel.modelDefinition;

      expectsql(
        () =>
          internals.getConstraintSnippet(myDefinition, {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: otherDefinition, field: 'id' },
          }),
        {
          default: `CONSTRAINT [MyModels_otherId_OtherModels_fk] FOREIGN KEY ([otherId]) REFERENCES [OtherModels] ([id])`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              type: 'FOREIGN KEY',
              fields: ['otherId'],
              references: { table: { tableName: 'otherTable', schema: 'mySchema' }, field: 'id' },
            },
          ),
        {
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [mySchema].[otherTable] ([id])`,
          sqlite3:
            'CONSTRAINT `myTable_otherId_otherTable_fk` FOREIGN KEY (`otherId`) REFERENCES `mySchema.otherTable` (`id`)',
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with foreign key schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
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
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [otherTable] ([id])`,
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const internalsSchema = sequelizeSchema.queryGenerator.__TEST__getInternals();

      expectsql(
        () =>
          internalsSchema.getConstraintSnippet('myTable', {
            type: 'FOREIGN KEY',
            fields: ['otherId'],
            references: { table: 'otherTable', field: 'id' },
          }),
        {
          default: `CONSTRAINT [myTable_otherId_otherTable_fk] FOREIGN KEY ([otherId]) REFERENCES [mySchema].[otherTable] ([id])`,
          sqlite3:
            'CONSTRAINT `myTable_otherId_otherTable_fk` FOREIGN KEY (`otherId`) REFERENCES `mySchema.otherTable` (`id`)',
        },
      );
    });

    it('generates a constraint snippet for a foreign key constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          internals.getConstraintSnippet(
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
          sqlite3:
            'CONSTRAINT `myTable_otherId_otherTable_fk` FOREIGN KEY (`otherId`) REFERENCES `mySchemacustomotherTable` (`id`)',
        },
      );
    });
  });

  describe('PRIMARY KEY constraints', () => {
    it('generates a constraint snippet for a primary key constraint with a name', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            name: 'primary key',
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `CONSTRAINT [primary key] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a deferred primary key constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'PRIMARY KEY',
            fields: ['username'],
            deferrable: Deferrable.INITIALLY_IMMEDIATE,
          }),
        {
          default: deferrableNotSupportedError,
          'postgres snowflake': `CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username]) DEFERRABLE INITIALLY IMMEDIATE`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint with multiple columns', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', {
            type: 'PRIMARY KEY',
            fields: ['first_name', 'last_name'],
          }),
        {
          default: `CONSTRAINT [myTable_first_name_last_name_pk] PRIMARY KEY ([first_name], [last_name])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet('myTable', { type: 'PRIMARY KEY', fields: ['username'] }),
        {
          default: `CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          internals.getConstraintSnippet(MyModel, { type: 'PRIMARY KEY', fields: ['username'] }),
        {
          default: `CONSTRAINT [MyModels_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});
      const myDefinition = MyModel.modelDefinition;

      expectsql(
        () =>
          internals.getConstraintSnippet(myDefinition, {
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `CONSTRAINT [MyModels_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint with schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema' },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          default: `CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint with primary key schema', () => {
      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: dialect.getDefaultSchema() },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          default: `CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const internalsSchema = sequelizeSchema.queryGenerator.__TEST__getInternals();

      expectsql(
        () =>
          internalsSchema.getConstraintSnippet('myTable', {
            type: 'PRIMARY KEY',
            fields: ['username'],
          }),
        {
          default: `CONSTRAINT [myTable_username_pk] PRIMARY KEY ([username])`,
        },
      );
    });

    it('generates a constraint snippet for a primary key constraint with schema and custom delimiter argument', () => {
      // This test is only relevant for dialects that do not support schemas
      if (dialect.supports.schemas) {
        return;
      }

      expectsql(
        () =>
          internals.getConstraintSnippet(
            { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
            { type: 'PRIMARY KEY', fields: ['username'] },
          ),
        {
          sqlite3: 'CONSTRAINT `myTable_username_pk` PRIMARY KEY (`username`)',
        },
      );
    });
  });
});
