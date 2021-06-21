import { DataTypes, Model, fn, literal, col } from 'sequelize';
// tslint:disable-next-line:no-submodule-imports
import { QueryInterface } from 'sequelize/lib/query-interface';

declare let queryInterface: QueryInterface;

async function test() {
  await queryInterface.createTable(
    'nameOfTheNewTable',
    {
      attr1: DataTypes.STRING,
      attr2: DataTypes.INTEGER,
      attr3: {
        allowNull: false,
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
      // foreign key usage
      attr4: {
        onDelete: 'cascade',
        onUpdate: 'cascade',
        references: {
          key: 'id',
          model: 'another_table_name',
        },
        type: DataTypes.INTEGER,
      },
      createdAt: {
        type: DataTypes.DATE,
      },
      id: {
        autoIncrement: true,
        primaryKey: true,
        type: DataTypes.INTEGER,
      },
      updatedAt: {
        type: DataTypes.DATE,
      },
    },
    {
      charset: 'latin1', // default: null
      collate: 'latin1_general_ci',
      engine: 'MYISAM', // default: 'InnoDB'
      uniqueKeys: {
        test: {
          customIndex: true,
          fields: ['attr2', 'attr3'],
        }
      }
    }
  );

  await queryInterface.dropTable('nameOfTheExistingTable');

  await queryInterface.bulkDelete({ tableName: 'foo', schema: 'bar' }, {}, {});

  const bulkInsertRes: Promise<number | object> = queryInterface.bulkInsert({ tableName: 'foo', as: 'bar', name: 'as' }, [{}], {});

  await queryInterface.bulkUpdate({ tableName: 'foo', delimiter: 'bar', as: 'baz', name: 'quz' }, {}, {});

  await queryInterface.dropTrigger({ tableName: 'foo', as: 'bar', name: 'baz' }, 'foo', {});

  await queryInterface.quoteTable({ tableName: 'foo', delimiter: 'bar' });

  await queryInterface.dropAllTables();

  await queryInterface.renameTable('Person', 'User');

  const tableNames: string[] = await queryInterface.showAllTables();

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
  const attributes: object = await queryInterface.describeTable('Person');

  await queryInterface.addColumn('nameOfAnExistingTable', 'nameOfTheNewAttribute', DataTypes.STRING);

  // or

  await queryInterface.addColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfTheNewAttribute',
    DataTypes.STRING
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
    defaultValue: 0.0,
    type: DataTypes.FLOAT,
  });

  // or

  await queryInterface.changeColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfAnExistingAttribute',
    {
      allowNull: false,
      defaultValue: 0.0,
      type: DataTypes.FLOAT,
    }
  );

  await queryInterface.renameColumn('Person', 'signature', 'sig');

  // This example will create the index person_firstname_lastname
  await queryInterface.addIndex('Person', ['firstname', 'lastname']);

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
      { name: 'foo_d', order: 'ASC', collate: 'foobar', length: 42 }
    ],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_b_lower',
    fields: [
      fn('lower', col('foo_b'))
    ],
  });

  await queryInterface.addIndex('Foo', {
    name: 'foo_c_lower',
    fields: [
      literal('LOWER(foo_c)')
    ]
  })

  await queryInterface.removeIndex('Person', 'SuperDuperIndex');

  // or

  await queryInterface.removeIndex('Person', ['firstname', 'lastname']);

  await queryInterface.sequelize.transaction(trx => queryInterface.addConstraint('Person', {
    name: 'firstnamexlastname',
    fields: ['firstname', 'lastname'],
    type: 'unique',
    transaction: trx,
  }))

  await queryInterface.removeConstraint('Person', 'firstnamexlastname');

  await queryInterface.select(null, 'Person', {
    where: {
      a: 1,
    },
  });

  await queryInterface.delete(null, 'Person', {
    where: {
      a: 1,
    },
  });

  class TestModel extends Model {}

  await queryInterface.upsert("test", {"a": 1}, {"b": 2}, {"c": 3}, TestModel, {});

  await queryInterface.insert(null, 'test', {});
}
