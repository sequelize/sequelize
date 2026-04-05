import type { AbstractQueryInterface, TableNameWithSchema } from '@sequelize/core';
import { DataTypes, Model, col, fn, literal } from '@sequelize/core';

declare let queryInterface: AbstractQueryInterface;

async function test() {
  await queryInterface.createTable(
    'nameOfTheNewTable',
    {
      attr1: DataTypes.STRING,
      attr2: DataTypes.INTEGER,
      attr3: {
        unique: true,
        allowNull: false,
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
      // foreign key usage
      attr4: {
        // @ts-expect-error -- unique attribute in createTable is boolean
        unique: 'attr4_pk',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
          key: 'id',
          table: 'another_table_name',
        },
        type: DataTypes.INTEGER,
      },
      attr5: {
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
          key: 'id',
          table: { schema: '<schema>', tableName: 'another_table_name' },
        },
        type: DataTypes.INTEGER,
      },
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
    },
    {
      charset: 'latin1', // default: null
      collate: 'latin1_general_ci',
      engine: 'MYISAM', // default: 'InnoDB'
      uniqueKeys: {
        test: {
          fields: ['attr2', 'attr3'],
        },
      },
    },
  );
  await queryInterface.createTable({ tableName: '<table-name>' }, {});

  await queryInterface.dropTable('nameOfTheExistingTable');
  await queryInterface.dropTable({ schema: '<schema>', tableName: 'nameOfTheExistingTable' });

  await queryInterface.bulkDelete({ tableName: 'foo', schema: 'bar' });

  const bulkInsertRes: Promise<number | object> = queryInterface.bulkInsert(
    { tableName: 'foo' },
    [{}],
    {},
  );

  const bulkInsertResWithAttrs: Promise<number | object> = queryInterface.bulkInsert(
    'foo',
    [{}],
    {},
    { bar: { type: DataTypes.JSON } },
  );

  await queryInterface.bulkUpdate({ tableName: 'foo', delimiter: 'bar' }, {}, {});

  await queryInterface.dropTrigger({ tableName: 'foo' }, 'foo', {});

  queryInterface.quoteIdentifier('foo');
  queryInterface.quoteIdentifier('foo', true);
  queryInterface.quoteIdentifiers('table.foo');

  await queryInterface.dropAllTables();

  await queryInterface.renameTable('Person', 'User');
  await queryInterface.renameTable(
    { schema: '<schema>', tableName: 'Person' },
    { schema: '<schema>', tableName: 'User' },
  );

  const tableNames: TableNameWithSchema[] = await queryInterface.listTables();

  /*
  attributes will be something like:

  {
    name: {
    type:     'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
    allowNull:  true,
    defaultValue: null
    },
    isBetaMember: {
    type:     'TINYINT(1)', // this will be 'BOOLEAN' for pg!
    allowNull:  false,
    defaultValue: false
    }
  }
  */
  const attributes = await queryInterface.describeTable('Person');

  await queryInterface.addColumn(
    'nameOfAnExistingTable',
    'nameOfTheNewAttribute',
    DataTypes.STRING,
  );

  // or

  await queryInterface.addColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfTheNewAttribute',
    DataTypes.STRING,
  );

  // or

  await queryInterface.addColumn('nameOfAnExistingTable', 'nameOfTheNewAttribute', {
    allowNull: false,
    type: DataTypes.STRING,
  });

  await queryInterface.removeColumn('Person', 'signature');

  // or

  await queryInterface.removeColumn({ tableName: 'Person', schema: 'nameOfSchema' }, 'signature');

  await queryInterface.changeColumn('nameOfAnExistingTable', 'nameOfAnExistingAttribute', {
    allowNull: false,
    defaultValue: 0,
    type: DataTypes.FLOAT,
  });

  // or

  await queryInterface.changeColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfAnExistingAttribute',
    {
      allowNull: false,
      defaultValue: 0,
      type: DataTypes.FLOAT,
    },
  );

  await queryInterface.renameColumn('Person', 'signature', 'sig');
  await queryInterface.renameColumn(
    { schema: '<schema>', tableName: 'Person' },
    'signature',
    'sig',
  );

  // This example will create the index person_firstname_lastname
  await queryInterface.addIndex('Person', ['firstname', 'lastname']);
  await queryInterface.addIndex({ schema: '<schema>', tableName: 'Person' }, [
    'firstname',
    'lastname',
  ]);

  // This example will create a unique index with the name SuperDuperIndex using the optional 'options' field.
  // Possible options:
  // - indexName: The name of the index. Default is __
  // - parser: For FULLTEXT columns set your parser
  // - indexType: Set a type for the index, e.g. BTREE. See the documentation of the used dialect
  // - logging: A function that receives the sql query, e.g. console.log
  await queryInterface.addIndex('Person', ['firstname', 'lastname'], {
    name: 'SuperDuperIndex',
    type: 'UNIQUE',
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_a',
    fields: [
      { name: 'foo_b', order: 'DESC' },
      'foo_c',
      { name: 'foo_d', order: 'ASC', collate: 'foobar', length: 42 },
    ],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_b_lower',
    fields: [fn('lower', col('foo_b'))],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_c_lower',
    fields: [literal('LOWER(foo_c)')],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_include_a',
    fields: ['foo_a'],
    include: ['foo_b'],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_include_literal_b',
    fields: ['foo_a'],
    include: literal('(foo_b)'),
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_include_literal_b',
    fields: ['foo_a'],
    include: [literal('foo_b')],
  });

  await queryInterface.removeIndex('Person', 'SuperDuperIndex');
  await queryInterface.removeIndex({ schema: '<schema>', tableName: 'Person' }, 'SuperDuperIndex');
  await queryInterface.removeIndex({ schema: '<schema>', tableName: 'Person' }, 'SuperDuperIndex', {
    ifExists: true,
  });

  const indexes = await queryInterface.showIndex('Person');
  indexes.map(index => ({
    name: index.name,
    table: index.tableName,
    unique: index.unique,
    primary: index.primary,
    fields: index.fields.map(field => field.attribute),
    type: index.type,
  }));

  // or

  await queryInterface.removeIndex('Person', ['firstname', 'lastname']);

  await queryInterface.sequelize.transaction(async trx =>
    queryInterface.addConstraint('Person', {
      name: 'firstnamexlastname',
      fields: ['firstname', 'lastname'],
      type: 'UNIQUE',
      transaction: trx,
    }),
  );

  await queryInterface.removeConstraint('Person', 'firstnamexlastname');
  await queryInterface.removeConstraint(
    { schema: '<schema>', tableName: 'Person' },
    'firstnamexlastname',
  );

  await queryInterface.select(null, 'Person', {
    where: {
      a: 1,
    },
  });
  await queryInterface.select(
    null,
    { schema: '<schema>', tableName: 'Person' },
    {
      where: {
        a: 1,
      },
    },
  );

  class TestModel extends Model {}

  await queryInterface.upsert('test', { a: 1 }, { b: 2 }, { c: 3 }, { model: TestModel });

  await queryInterface.insert(null, 'test', {});
}
