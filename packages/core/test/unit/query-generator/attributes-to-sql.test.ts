import { expectPerDialect, sequelize } from '../../support';

// TODO: attributesToSQL is declared as accepting a ColumnsDescription, which does not describe the
//  attribute options (references, unique, comment, ...) that every dialect reads. Drop this cast
//  once the method is properly typed.
const queryGenerator = sequelize.dialect.queryGenerator as unknown as {
  attributesToSQL(
    attributes: Record<string, unknown>,
    options?: Record<string, unknown>,
    // db2 returns an array of fragments in the changeColumn context
  ): Record<string, string | string[]>;
};

describe('QueryGenerator#attributesToSQL', () => {
  it('generates a SQL representation for a single attribute', () => {
    expectPerDialect(() => queryGenerator.attributesToSQL({ id: { type: 'INTEGER' } }), {
      default: { id: 'INTEGER' },
      'mssql oracle': { id: 'INTEGER NULL' },
    });
  });

  it('generates a SQL representation for multiple attributes', () => {
    expectPerDialect(
      () => queryGenerator.attributesToSQL({ id: { type: 'INTEGER' }, name: { type: 'STRING' } }),
      {
        default: { id: 'INTEGER', name: 'STRING' },
        'mssql oracle': { id: 'INTEGER NULL', name: 'STRING NULL' },
      },
    );
  });

  // TODO: mssql and ibmi shallow-clone the attribute before reading it, which turns a plain string
  //  into an object without a type.
  it('generates a SQL representation for attributes that are plain strings', () => {
    expectPerDialect(() => queryGenerator.attributesToSQL({ id: 'INTEGER', foo: 'VARCHAR(255)' }), {
      default: { id: 'INTEGER', foo: 'VARCHAR(255)' },
      'mssql oracle': { id: 'INTEGER NULL', foo: 'VARCHAR(255) NULL' },
    });
  });

  it('keys the result on the field name instead of the attribute name', () => {
    expectPerDialect(
      () => queryGenerator.attributesToSQL({ id: { type: 'INTEGER', field: 'foo' } }),
      {
        default: { foo: 'INTEGER' },
        'mssql oracle': { foo: 'INTEGER NULL' },
      },
    );
  });

  it('keys the result on the columnName', () => {
    expectPerDialect(
      () => queryGenerator.attributesToSQL({ id: { type: 'INTEGER', columnName: 'foo' } }),
      {
        default: { foo: 'INTEGER' },
        'mssql oracle': { foo: 'INTEGER NULL' },
      },
    );
  });

  it('generates a SQL representation for a reference when no options are provided', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({ id: { type: 'INTEGER', references: { table: 'Bar' } } }),
      {
        default: { id: 'INTEGER REFERENCES "Bar" ("id")' },
        'mariadb mysql sqlite3': { id: 'INTEGER REFERENCES `Bar` (`id`)' },
        mssql: { id: 'INTEGER NULL REFERENCES [Bar] ([id])' },
        oracle: { id: 'INTEGER NULL REFERENCES "Bar" ("id")' },
      },
    );
  });

  // TODO: db2 and mssql drop the referential actions of every reference after the first one to a
  //  given table, and mssql drops ON UPDATE unconditionally.
  it('generates a SQL representation for two references to the same table', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          a: { type: 'INTEGER', references: { table: 'Bar' } },
          b: { type: 'INTEGER', references: { table: 'Bar' } },
        }),
      {
        default: { a: 'INTEGER REFERENCES "Bar" ("id")', b: 'INTEGER REFERENCES "Bar" ("id")' },
        'mariadb mysql sqlite3': {
          a: 'INTEGER REFERENCES `Bar` (`id`)',
          b: 'INTEGER REFERENCES `Bar` (`id`)',
        },
        mssql: {
          a: 'INTEGER NULL REFERENCES [Bar] ([id])',
          b: 'INTEGER NULL REFERENCES [Bar] ([id])',
        },
        oracle: {
          a: 'INTEGER NULL REFERENCES "Bar" ("id")',
          b: 'INTEGER NULL REFERENCES "Bar" ("id")',
        },
      },
    );
  });

  it('generates a SQL representation for two references to different tables', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          a: { type: 'INTEGER', references: { table: 'Bar' } },
          b: { type: 'INTEGER', references: { table: 'Baz' } },
        }),
      {
        default: { a: 'INTEGER REFERENCES "Bar" ("id")', b: 'INTEGER REFERENCES "Baz" ("id")' },
        'mariadb mysql sqlite3': {
          a: 'INTEGER REFERENCES `Bar` (`id`)',
          b: 'INTEGER REFERENCES `Baz` (`id`)',
        },
        mssql: {
          a: 'INTEGER NULL REFERENCES [Bar] ([id])',
          b: 'INTEGER NULL REFERENCES [Baz] ([id])',
        },
        oracle: {
          a: 'INTEGER NULL REFERENCES "Bar" ("id")',
          b: 'INTEGER NULL REFERENCES "Baz" ("id")',
        },
      },
    );
  });

  it('generates a SQL representation for a comment in the createTable context', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL(
          { id: { type: 'INTEGER', comment: 'Test' } },
          { context: 'createTable', tableOrModel: 'myTable' },
        ),
      {
        default: { id: "INTEGER COMMENT 'Test'" },
        'postgres db2': { id: 'INTEGER COMMENT Test' },
        'sqlite3 ibmi': { id: 'INTEGER' },
        mssql: { id: 'INTEGER NULL COMMENT Test' },
        oracle: { id: 'INTEGER NULL' },
      },
    );
  });

  it('generates a SQL representation for a comment in the addColumn context', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL(
          { id: { type: 'INTEGER', comment: 'Test' } },
          { context: 'addColumn', tableOrModel: 'myTable' },
        ),
      {
        default: { id: "INTEGER COMMENT 'Test'" },
        'sqlite3 ibmi': { id: 'INTEGER' },
        postgres: { id: `INTEGER; COMMENT ON COLUMN "myTable"."id" IS 'Test'` },
        mssql: { id: 'INTEGER NULL COMMENT Test' },
        db2: { id: 'INTEGER COMMENT Test' },
        oracle: { id: 'INTEGER NULL' },
      },
    );
  });

  it('generates a SQL representation for two references to the same table with referential actions', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          a: {
            type: 'INTEGER',
            references: { table: 'Bar' },
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
          b: {
            type: 'INTEGER',
            references: { table: 'Bar' },
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
        }),
      {
        default: {
          a: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          b: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake ibmi': {
          a: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          b: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: {
          a: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE',
          b: 'INTEGER NULL REFERENCES [Bar] ([id])',
        },
        db2: {
          a: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          b: 'INTEGER REFERENCES "Bar" ("id")',
        },
        oracle: {
          a: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE',
          b: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE',
        },
      },
    );
  });

  it('generates a SQL representation for two references to different tables with referential actions', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          a: {
            type: 'INTEGER',
            references: { table: 'Bar' },
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
          b: {
            type: 'INTEGER',
            references: { table: 'Baz' },
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
        }),
      {
        default: {
          a: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          b: 'INTEGER REFERENCES "Baz" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'mariadb mysql sqlite3': {
          a: 'INTEGER REFERENCES `Bar` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          b: 'INTEGER REFERENCES `Baz` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: {
          a: 'INTEGER NULL REFERENCES [Bar] ([id]) ON DELETE CASCADE',
          b: 'INTEGER NULL REFERENCES [Baz] ([id]) ON DELETE CASCADE',
        },
        oracle: {
          a: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE',
          b: 'INTEGER NULL REFERENCES "Baz" ("id") ON DELETE CASCADE',
        },
      },
    );
  });

  // TODO: db2 silently drops the referential actions when the attribute is also unique.
  it('generates a SQL representation for a unique attribute that also references a table', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          a: { type: 'INTEGER', unique: true, references: { table: 'Bar' }, onDelete: 'CASCADE' },
        }),
      {
        default: { a: 'INTEGER UNIQUE REFERENCES `Bar` (`id`) ON DELETE CASCADE' },
        'postgres snowflake ibmi': {
          a: 'INTEGER UNIQUE REFERENCES "Bar" ("id") ON DELETE CASCADE',
        },
        mssql: { a: 'INTEGER NULL UNIQUE REFERENCES [Bar] ([id]) ON DELETE CASCADE' },
        db2: { a: 'INTEGER UNIQUE REFERENCES "Bar" ("id")' },
        oracle: { a: 'INTEGER NULL REFERENCES "Bar" ("id") ON DELETE CASCADE' },
      },
    );
  });

  it('omits foreign key constraints when withoutForeignKeyConstraints is set', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL(
          { id: { type: 'INTEGER', references: { table: 'Bar' } } },
          { withoutForeignKeyConstraints: true },
        ),
      {
        default: { id: 'INTEGER' },
        'mssql oracle': { id: 'INTEGER NULL' },
      },
    );
  });

  it('generates a SQL representation in the changeColumn context', () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL(
          { id: { type: 'INTEGER', allowNull: true } },
          { context: 'changeColumn', tableOrModel: 'myTable' },
        ),
      {
        default: { id: 'INTEGER' },
        'mssql oracle': { id: 'INTEGER NULL' },
        db2: { id: ['DATA TYPE INTEGER', 'DROP NOT NULL'] },
        ibmi: { id: 'INTEGER DROP NOT NULL' },
      },
    );
  });
});
