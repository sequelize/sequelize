import { DataTypes } from 'sequelize';
// tslint:disable-next-line:no-submodule-imports
import { QueryInterface } from 'sequelize/lib/query-interface';

declare let queryInterface: QueryInterface;

queryInterface.createTable(
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

queryInterface.dropTable('nameOfTheExistingTable');

queryInterface.dropAllTables();

queryInterface.renameTable('Person', 'User');

queryInterface.showAllTables().then(tableNames => {
    // do nothing
});

queryInterface.describeTable('Person').then(attributes => {
    /*
    attributes will be something like:

    {
      name: {
        type:         'VARCHAR(255)', // this will be 'CHARACTER VARYING' for pg!
        allowNull:    true,
        defaultValue: null
      },
      isBetaMember: {
        type:         'TINYINT(1)', // this will be 'BOOLEAN' for pg!
        allowNull:    false,
        defaultValue: false
      }
    }
  */
});

queryInterface.addColumn('nameOfAnExistingTable', 'nameOfTheNewAttribute', DataTypes.STRING);

// or

queryInterface.addColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfTheNewAttribute',
    DataTypes.STRING
);

// or

queryInterface.addColumn('nameOfAnExistingTable', 'nameOfTheNewAttribute', {
    allowNull: false,
    type: DataTypes.STRING,
});

queryInterface.removeColumn('Person', 'signature');

// or

queryInterface.removeColumn({ tableName: 'Person', schema: 'nameOfSchema' }, 'signature');

queryInterface.changeColumn('nameOfAnExistingTable', 'nameOfAnExistingAttribute', {
    allowNull: false,
    defaultValue: 0.0,
    type: DataTypes.FLOAT,
});

// or

queryInterface.changeColumn(
    { tableName: 'nameOfAnExistingTable', schema: 'nameOfSchema' },
    'nameOfAnExistingAttribute',
    {
        allowNull: false,
        defaultValue: 0.0,
        type: DataTypes.FLOAT,
    }
);

queryInterface.renameColumn('Person', 'signature', 'sig');

// This example will create the index person_firstname_lastname
queryInterface.addIndex('Person', ['firstname', 'lastname']);

// This example will create a unique index with the name SuperDuperIndex using the optional 'options' field.
// Possible options:
// - indicesType: UNIQUE|FULLTEXT|SPATIAL
// - indexName: The name of the index. Default is __
// - parser: For FULLTEXT columns set your parser
// - indexType: Set a type for the index, e.g. BTREE. See the documentation of the used dialect
// - logging: A function that receives the sql query, e.g. console.log
queryInterface.addIndex('Person', ['firstname', 'lastname'], {
    indexName: 'SuperDuperIndex',
    indicesType: 'UNIQUE',
});

queryInterface.removeIndex('Person', 'SuperDuperIndex');

// or

queryInterface.removeIndex('Person', ['firstname', 'lastname']);

queryInterface.addConstraint('Person', ['firstname', 'lastname'], {
    name: 'firstnamexlastname',
    type: 'unique',
});

queryInterface.removeConstraint('Person', 'firstnamexlastname');
