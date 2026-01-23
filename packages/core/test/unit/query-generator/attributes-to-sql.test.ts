import { expectPerDialect, sequelize } from '../../support';

describe('QueryGenerator#attributesToSQL', () => {
  const queryGenerator = sequelize.queryGenerator;

  it(`generates a SQL representation for a single attribute`, () => {
    // @ts-expect-error -- Improperly typed method
    expectPerDialect(() => queryGenerator.attributesToSQL({ id: { type: 'INTEGER' } }), {
      default: { id: 'INTEGER' },
      mssql: { id: 'INTEGER NULL' },
    });
  });

  it(`generates a SQL representation for two attribute`, () => {
    expectPerDialect(
      // @ts-expect-error -- Improperly typed method
      () => queryGenerator.attributesToSQL({ id: { type: 'INTEGER' }, name: { type: 'STRING' } }),
      {
        default: { id: 'INTEGER', name: 'STRING' },
        mssql: { id: 'INTEGER NULL', name: 'STRING NULL' },
      },
    );
  });

  it(`generates a SQL representation for a single attribute with a different field name`, () => {
    expectPerDialect(
      // @ts-expect-error -- Improperly typed method
      () => queryGenerator.attributesToSQL({ id: { type: 'INTEGER', field: 'foo' } }),
      {
        default: { foo: 'INTEGER' },
        mssql: { foo: 'INTEGER NULL' },
      },
    );
  });

  it(`generates a SQL representation for a single attribute with reference to a table`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          // @ts-expect-error -- Improperly typed method
          id: { type: 'INTEGER', references: { table: 'myTable' } },
        }),
      {
        'mariadb mysql sqlite3': { id: 'INTEGER REFERENCES `myTable` (`id`)' },
        'postgres snowflake db2 ibmi': { id: 'INTEGER REFERENCES "myTable" ("id")' },
        mssql: { id: 'INTEGER NULL REFERENCES [myTable] ([id])' },
      },
    );
  });

  it(`generates a SQL representation for a single attribute with reference to a table and onUpdate/onDelete constraints`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          id: {
            type: 'INTEGER',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
        }),
      {
        'mariadb mysql sqlite3': {
          id: 'INTEGER REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake db2 ibmi': {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: { id: 'INTEGER NULL REFERENCES [myTable] ([id]) ON DELETE CASCADE' },
      },
    );
  });

  it(`generates a SQL representation for a single attribute with reference to a table and unique onUpdate/onDelete constraints`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          id: {
            type: 'INTEGER',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
            unique: true,
          },
        }),
      {
        'mariadb mysql sqlite3': {
          id: 'INTEGER UNIQUE REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake ibmi': {
          id: 'INTEGER UNIQUE REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        db2: { id: 'INTEGER UNIQUE REFERENCES "myTable" ("id")' },
        mssql: { id: 'INTEGER NULL UNIQUE REFERENCES [myTable] ([id]) ON DELETE CASCADE' },
      },
    );
  });

  it(`generates a SQL representation for two attributes with reference to the same table and onUpdate/onDelete constraints`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          id: {
            type: 'INTEGER',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'rEsTrIcT',
            onDelete: 'cAsCaDe',
          },
          name: {
            type: 'STRING',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
        }),
      {
        'mariadb mysql sqlite3': {
          id: 'INTEGER REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake ibmi': {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: {
          id: 'INTEGER NULL REFERENCES [myTable] ([id]) ON DELETE CASCADE',
          name: 'STRING NULL REFERENCES [myTable] ([id])',
        },
        db2: {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES "myTable" ("id")',
        },
      },
    );
  });

  it(`generates a SQL representation for two attributes with reference to different tables and onUpdate/onDelete constraints`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          id: {
            type: 'INTEGER',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
          name: {
            type: 'STRING',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'otherTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
        }),
      {
        'mariadb mysql sqlite3': {
          id: 'INTEGER REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake db2 ibmi': {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: {
          id: 'INTEGER NULL REFERENCES [myTable] ([id]) ON DELETE CASCADE',
          name: 'STRING NULL REFERENCES [otherTable] ([id]) ON DELETE CASCADE',
        },
      },
    );
  });

  it(`generates a SQL representation for two attributes with reference to a mix of tables and onUpdate/onDelete constraints`, () => {
    expectPerDialect(
      () =>
        queryGenerator.attributesToSQL({
          id: {
            type: 'INTEGER',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
          birthdate: {
            type: 'DATE',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'myTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
          name: {
            type: 'STRING',
            // @ts-expect-error -- Improperly typed method
            references: { table: 'otherTable' },
            onUpdate: 'RESTRICT',
            onDelete: 'CASCADE',
          },
        }),
      {
        'mariadb mysql sqlite3': {
          id: 'INTEGER REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          birthdate: 'DATE REFERENCES `myTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES `otherTable` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        'postgres snowflake ibmi': {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          birthdate: 'DATE REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          name: 'STRING REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
        mssql: {
          id: 'INTEGER NULL REFERENCES [myTable] ([id]) ON DELETE CASCADE',
          birthdate: 'DATE NULL REFERENCES [myTable] ([id])',
          name: 'STRING NULL REFERENCES [otherTable] ([id]) ON DELETE CASCADE',
        },
        db2: {
          id: 'INTEGER REFERENCES "myTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
          birthdate: 'DATE REFERENCES "myTable" ("id")',
          name: 'STRING REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE RESTRICT',
        },
      },
    );
  });
});
