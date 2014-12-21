'use strict';

var chai = require('chai')
  , expect = chai.expect
  , QueryGenerator = require('../../../lib/dialects/postgres/query-generator')
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , moment = require('moment')
  , util = require('util')
  , _ = require('lodash');

chai.config.includeStack = true;

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryGenerator', function() {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        email: {type: DataTypes.ARRAY(DataTypes.TEXT)},
        numbers: {type: DataTypes.ARRAY(DataTypes.FLOAT)},
        document: {type: DataTypes.HSTORE, defaultValue: '"default"=>"value"'}
      });
      return this.User.sync({ force: true });
    });

    var suites = {
      attributesToSQL: [
        {
          arguments: [{id: 'INTEGER'}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: 'INTEGER', foo: 'VARCHAR(255)'}],
          expectation: {id: 'INTEGER', foo: 'VARCHAR(255)'}
        },
        {
          arguments: [{id: {type: 'INTEGER'}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false}}],
          expectation: {id: 'INTEGER NOT NULL'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: true}}],
          expectation: {id: 'INTEGER'}
        },
        {
          arguments: [{id: {type: 'INTEGER', primaryKey: true, autoIncrement: true}}],
          expectation: {id: 'INTEGER SERIAL PRIMARY KEY'}
        },
        {
          arguments: [{id: {type: 'INTEGER', defaultValue: 0}}],
          expectation: {id: 'INTEGER DEFAULT 0'}
        },
        {
          arguments: [{id: {type: 'INTEGER', unique: true}}],
          expectation: {id: 'INTEGER UNIQUE'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id")'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', referencesKey: 'pk'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("pk")'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', onDelete: 'CASCADE'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE'}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT'}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: 'Bar', onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT'}
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id)'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', referencesKey: 'pk'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (pk)'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', onDelete: 'CASCADE'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', references: 'Bar', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT'},
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{id: {type: 'INTEGER', allowNull: false, defaultValue: 1, references: 'Bar', onDelete: 'CASCADE', onUpdate: 'RESTRICT'}}],
          expectation: {id: 'INTEGER NOT NULL DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT'},
          context: {options: {quoteIdentifiers: false}}
        }

      ],

      createTableQuery: [
        {
          arguments: ['myTable', {int: 'INTEGER(1)', bigint: 'BIGINT(12)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"int\" INTEGER, \"bigint\" BIGINT);'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {data: 'BLOB'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" bytea);'
        },
        {
          arguments: ['myTable', {data: 'LONGBLOB'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" bytea);'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"mySchema\".\"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" \"enum_myTable_title\", \"name\" VARCHAR(255));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"id\" INTEGER , PRIMARY KEY (\"id\"));'
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: 'CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"otherId\" INTEGER REFERENCES \"otherTable\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION);'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS mySchema.myTable (title VARCHAR(255), name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title enum_myTable_title, name VARCHAR(255));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), id INTEGER , PRIMARY KEY (id));',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), otherId INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      dropTableQuery: [
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS \"myTable\";'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'DROP TABLE IF EXISTS \"mySchema\".\"myTable\";'
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS \"myTable\" CASCADE;'
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS \"mySchema\".\"myTable\" CASCADE;'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'DROP TABLE IF EXISTS myTable;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS myTable CASCADE;',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {cascade: true}],
          expectation: 'DROP TABLE IF EXISTS mySchema.myTable CASCADE;',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM \"myTable\";'
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: 'SELECT \"id\", \"name\" FROM \"myTable\";'
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: 'SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\"=2;'
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\"='foo';"
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\"='foo'';DROP TABLE myTable;';"
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: 'SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\"=2;'
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS \"count\" FROM \"foo\";'
        }, {
          arguments: ['myTable', {where: "foo='bar'"}],
          expectation: "SELECT * FROM \"myTable\" WHERE foo='bar';"
        }, {
          arguments: ['myTable', {order: 'id DESC'}],
          expectation: 'SELECT * FROM \"myTable\" ORDER BY id DESC;'
        }, {
          arguments: ['myTable', {order: ['id']}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id";',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: ['myTable.id']}],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id";',
          context: QueryGenerator
        }, {
          arguments: ['myTable', {order: [['id', 'DESC']]}, function(sequelize) {return sequelize.define('myTable', {});}],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
         title: 'raw arguments are neither quoted nor escaped',
          arguments: ['myTable', {order: [[{raw: 'f1(f2(id))'},'DESC']]}],
          expectation: 'SELECT * FROM "myTable" ORDER BY f1(f2(id)) DESC;',
          context: QueryGenerator
        }, {
          title: 'sequelize.where with .fn as attribute and default comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'jan'),
                { type: 1 }
              )
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") = \'jan\' AND "myTable"."type"=1);',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'sequelize.where with .fn as attribute and LIKE comparator',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'LIKE', '%t%'),
                { type: 1 }
              )
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") LIKE \'%t%\' AND "myTable"."type"=1);',
          context: QueryGenerator,
          needsSequelize: true
        },{
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']]
            };
          }],
          expectation: 'SELECT * FROM "myTable" ORDER BY f1(f2("id")) DESC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'functions can take all types as arguments',
          arguments: ['myTable', function(sequelize) {
            return {
              order: [
                [sequelize.fn('f1', sequelize.col('myTable.id')), 'DESC'],
                [sequelize.fn('f2', 12, 'lalala', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))), 'ASC']
              ]
            };
          }],
          expectation: 'SELECT * FROM "myTable" ORDER BY f1("myTable"."id") DESC, f2(12, \'lalala\', \'2011-03-27 10:01:55.000 +00:00\') ASC;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { in: ... }',
          arguments: ['myTable', function(sequelize) {
            return {
              where: sequelize.and(
                { archived: null},
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { in : ['Lost', 'Found'] })
              )
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE ("myTable"."archived" IS NULL AND COALESCE("place_type_codename", "announcement_type_codename") IN (\'Lost\',\'Found\'));',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'single string argument is not quoted',
          arguments: ['myTable', {group: 'name'}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY name;'
        }, {
          arguments: ['myTable', {group: ['name']}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY \"name\";'
        }, {
          title: 'functions work for group by',
         arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))]
            };
          }],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY YEAR(\"createdAt\");',
          needsSequelize: true
        },{
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function(sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title']
            };
          }],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY YEAR(\"createdAt\"), \"title\";',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {group: ['name', 'title']}],
          expectation: 'SELECT * FROM \"myTable\" GROUP BY \"name\", \"title\";'
        }, {
          title: 'HAVING clause works with string replacements',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: ['creationYear > ?', 2002]
            };
          }],
          expectation: 'SELECT *, YEAR(\"createdAt\") AS \"creationYear\" FROM \"myTable\" GROUP BY \"creationYear\", \"title\" HAVING creationYear > 2002;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          title: 'HAVING clause works with where-like hash',
          arguments: ['myTable', function(sequelize) {
            return {
              attributes: ['*', [sequelize.fn('YEAR', sequelize.col('createdAt')), 'creationYear']],
              group: ['creationYear', 'title'],
              having: { creationYear: { gt: 2002 } }
            };
          }],
          expectation: 'SELECT *, YEAR(\"createdAt\") AS \"creationYear\" FROM \"myTable\" GROUP BY \"creationYear\", \"title\" HAVING \"creationYear\" > 2002;',
          context: QueryGenerator,
          needsSequelize: true
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: 'SELECT * FROM \"myTable\" LIMIT 10;'
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: 'SELECT * FROM \"myTable\" LIMIT 10 OFFSET 2;'
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: 'SELECT * FROM \"myTable\" OFFSET 2;'
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'SELECT * FROM \"mySchema\".\"myTable\";'
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM \"mySchema\".\"myTable\" WHERE \"mySchema\".\"myTable\".\"name\"='foo'';DROP TABLE mySchema.myTable;';"
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', {where: { field: new Buffer('Sequelize')}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"field\"=E'\\\\x53657175656c697a65';",
          context: QueryGenerator
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: 'SELECT id, name FROM myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.id=2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM myTable WHERE myTable.name='foo';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM myTable WHERE myTable.name='foo'';DROP TABLE myTable;';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: 'SELECT * FROM myTable WHERE myTable.id=2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) AS count FROM foo;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: "foo='bar'"}],
          expectation: "SELECT * FROM myTable WHERE foo='bar';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {order: 'id DESC'}],
          expectation: 'SELECT * FROM myTable ORDER BY id DESC;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: 'name'}],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ['name']}],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ['name', 'title']}],
          expectation: 'SELECT * FROM myTable GROUP BY name, title;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: 'SELECT * FROM myTable LIMIT 10;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: 'SELECT * FROM myTable LIMIT 10 OFFSET 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: 'SELECT * FROM myTable OFFSET 2;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}],
          expectation: 'SELECT * FROM mySchema.myTable;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM mySchema.myTable WHERE mySchema.myTable.name='foo'';DROP TABLE mySchema.myTable;';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', {where: {field: {ne: 0}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field != 0;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', {where: {field: {ne: null}}}],
          expectation: 'SELECT * FROM myTable WHERE myTable.field IS NOT NULL;',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', {}],
          expectation: 'INSERT INTO \"myTable\" DEFAULT VALUES;'
        },
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');"
        }, {
          arguments: ['myTable', {name: 'foo'}, {}, { returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') RETURNING *;"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;');"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', {data: new Buffer('Sequelize') }],
          expectation: "INSERT INTO \"myTable\" (\"data\") VALUES (E'\\\\x53657175656c697a65');"
        }, {
          arguments: ['myTable', {name: 'foo', numbers: new Uint8Array([1, 2, 3])}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"numbers\") VALUES ('foo',ARRAY[1,2,3]);"
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1);"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL);"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo');",
          context: {options: {omitNull: true}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo'}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo');"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}');"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;');"
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              foo: sequelize.fn('NOW')
            };
          }],
          expectation: 'INSERT INTO \"myTable\" (\"foo\") VALUES (NOW());',
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', numbers: new Uint8Array([1, 2, 3])}],
          expectation: "INSERT INTO myTable (name,numbers) VALUES ('foo',ARRAY[1,2,3]);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL);",
          context: {options: {omitNull: false, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo');",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo'}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;');",
          context: {options: {quoteIdentifiers: false}}
        }

      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar');"
        }, {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}], { returning: true }],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar') RETURNING *;"
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;'),('bar');"
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {name: 'bar', birthday: moment('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');"
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1),('bar',2);"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true}} // Note: As above
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'),('bar');"
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}');"
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar');"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {name: 'bar', birthday: moment('2012-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}]],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1),('bar',2);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {quoteIdentifiers: false, omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL);",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: As above
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}');",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar');",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, 2],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2"
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo'"
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}, { returning: true }],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo' RETURNING *"
        }, {
          arguments: ['myTable', {numbers: new Uint8Array([1, 2, 3])}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"numbers\"=ARRAY[1,2,3] WHERE \"name\"='foo'"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo'';DROP TABLE myTable;' WHERE \"name\"='foo'"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\"='foo'"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\"='foo'",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo'",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo'",
          context: {options: {omitNull: true}}
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2"
        }, {
          arguments: [{tableName: 'myTable', schema: 'mySchema'}, {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo'';DROP TABLE mySchema.myTable;' WHERE \"name\"='foo'"
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.fn('NOW')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=NOW() WHERE \"name\"='foo'",
          needsSequelize: true
        }, {
          arguments: ['myTable', function(sequelize) {
            return {
              bar: sequelize.col('foo')
            };
          }, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=\"foo\" WHERE \"name\"='foo'",
          needsSequelize: true
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, 2],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {numbers: new Uint8Array([1, 2, 3])}, {name: 'foo'}],
          expectation: "UPDATE myTable SET numbers=ARRAY[1,2,3] WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE myTable SET name='foo'';DROP TABLE myTable;' WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name='foo'",
          context: {options: {omitNull: false, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo'",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo'",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {name: 'foo', birthday: moment('2011-03-27 10:01:55 +0000', 'YYYY-MM-DD HH:mm:ss Z').toDate()}, {id: 2}],
          expectation: "UPDATE mySchema.myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [{schema: 'mySchema', tableName: 'myTable'}, {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE mySchema.myTable SET name='foo'';DROP TABLE mySchema.myTable;' WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      deleteQuery: [
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"name\"='foo' LIMIT 1)"
        }, {
          arguments: ['myTable', 1],
          expectation: 'DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"id\"=1 LIMIT 1)'
        }, {
          arguments: ['myTable', undefined, {truncate: true}],
          expectation: 'TRUNCATE \"myTable\"'
        }, {
          arguments: ['myTable', undefined, {truncate: true, cascade: true}],
          expectation: 'TRUNCATE \"myTable\" CASCADE'
        }, {
          arguments: ['myTable', 1, {limit: 10, truncate: true}],
          expectation: 'TRUNCATE \"myTable\"'
        }, {
          arguments: ['myTable', 1, {limit: 10}],
          expectation: 'DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"id\"=1 LIMIT 10)'
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {limit: 10}],
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"name\"='foo'';DROP TABLE myTable;' LIMIT 10)"
        }, {
          arguments: ['mySchema.myTable', {name: 'foo'}],
          expectation: "DELETE FROM \"mySchema\".\"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"mySchema\".\"myTable\" WHERE \"name\"='foo' LIMIT 1)"
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}, {limit: 10}],
          expectation: "DELETE FROM \"mySchema\".\"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"mySchema\".\"myTable\" WHERE \"name\"='foo'';DROP TABLE mySchema.myTable;' LIMIT 10)"
        }, {
          arguments: ['myTable', {name: 'foo'}, {limit: null}],
          expectation: "DELETE FROM \"myTable\" WHERE \"name\"='foo'"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE name='foo' LIMIT 1)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', 1],
          expectation: 'DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE id=1 LIMIT 1)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', 1, {limit: 10}],
          expectation: 'DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE id=1 LIMIT 10)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {limit: 10}],
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE name='foo'';DROP TABLE myTable;' LIMIT 10)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: 'foo'}],
          expectation: "DELETE FROM mySchema.myTable WHERE id IN (SELECT id FROM mySchema.myTable WHERE name='foo' LIMIT 1)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}, {limit: 10}],
          expectation: "DELETE FROM mySchema.myTable WHERE id IN (SELECT id FROM mySchema.myTable WHERE name='foo'';DROP TABLE mySchema.myTable;' LIMIT 10)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo'}, {limit: null}],
          expectation: "DELETE FROM myTable WHERE name='foo'",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      addIndexQuery: [
        {
          arguments: ['User', ['username', 'isAdmin'], {}, 'User'],
          expectation: 'CREATE INDEX \"user_username_is_admin\" ON \"User\" (\"username\", \"isAdmin\")'
        }, {
          arguments: [
            'User', [
              { attribute: 'username', length: 10, order: 'ASC'},
              'isAdmin'
            ],
            {},
            'User'
          ],
          expectation: 'CREATE INDEX \"user_username_is_admin\" ON \"User\" (\"username\" ASC, \"isAdmin\")'
        }, {
          arguments: ['User', ['username', 'isAdmin'], { indexName: 'bar'}, {}, 'User'],
          expectation: 'CREATE INDEX \"bar\" ON \"User\" (\"username\", \"isAdmin\")'
        }, {
          arguments: ['mySchema.User', ['username', 'isAdmin'], {}, 'User'],
          expectation: 'CREATE INDEX \"user_username_is_admin\" ON \"mySchema\".\"User\" (\"username\", \"isAdmin\")'
        }, {
          arguments: ['User', ['fieldB', {attribute: 'fieldA', collate: 'en_US', order: 'DESC', length: 5}], {
            name: 'a_b_uniq',
            unique: true,
            method: 'BTREE'
          }, 'User'],
          expectation: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" USING BTREE ("fieldB", "fieldA" COLLATE "en_US" DESC)'
        }, {
          arguments: ['User', ['fieldC'], {
            type: 'FULLTEXT',
            concurrently: true
          }, 'User'],
          expectation: 'CREATE INDEX CONCURRENTLY "user_field_c" ON "User" ("fieldC")'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', ['username', 'isAdmin'], {}, 'User'],
          expectation: 'CREATE INDEX user_username_is_admin ON User (username, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [
            'User', [
              { attribute: 'username', length: 10, order: 'ASC'},
              'isAdmin'
            ],
            {},
            'User'
          ],
          expectation: 'CREATE INDEX user_username_is_admin ON User (username ASC, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', ['username', 'isAdmin'], { indexName: 'bar'}, {}, 'User'],
          expectation: 'CREATE INDEX bar ON User (username, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.User', ['username', 'isAdmin'], {}, 'User'],
          expectation: 'CREATE INDEX user_username_is_admin ON mySchema.User (username, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      removeIndexQuery: [
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS \"user_foo_bar\"'
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS \"user_foo_bar\"'
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS \"mySchema\".\"user_foo_bar\"'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: 'DROP INDEX IF EXISTS user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: 'DROP INDEX IF EXISTS mySchema.user_foo_bar',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      hashToWhereConditions: [
        {
          arguments: [{ id: [1, 2, 3] }],
          expectation: '\"id\" IN (1,2,3)'
        },
        {
          arguments: [{ id: [] }],
          expectation: '\"id\" IN (NULL)'
        },
        {
          arguments: [{id: {not: [1, 2, 3] }}],
          expectation: '\"id\" NOT IN (1,2,3)'
        },
        {
          arguments: [{id: {not: [] }}],
          expectation: '\"id\" NOT IN (NULL)'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{ id: [1, 2, 3] }],
          expectation: 'id IN (1,2,3)',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{ id: [] }],
          expectation: 'id IN (NULL)',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{ id: {not: [1, 2, 3] }}],
          expectation: 'id NOT IN (1,2,3)',
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{ id: {not: [] }}],
          expectation: 'id NOT IN (NULL)',
          context: {options: {quoteIdentifiers: false}}
        }
      ]
    };

    _.each(suites, function(tests, suiteTitle) {
      describe(suiteTitle, function() {
        afterEach(function() {
          this.sequelize.options.quoteIdentifiers = true;
          QueryGenerator.options.quoteIdentifiers = true;
        });

        tests.forEach(function(test) {
          var title = test.title || 'Postgres correctly returns ' + test.expectation + ' for ' + JSON.stringify(test.arguments);
          it(title, function() {
            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            var context = test.context || {options: {}};
            if (test.needsSequelize) {
              if (_.isFunction(test.arguments[1])) test.arguments[1] = test.arguments[1](this.sequelize);
              if (_.isFunction(test.arguments[2])) test.arguments[2] = test.arguments[2](this.sequelize);
            }
            QueryGenerator.options = context.options;
            QueryGenerator._dialect = this.sequelize.dialect;
            var conditions = QueryGenerator[suiteTitle].apply(QueryGenerator, test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        });
      });
    });
  });
}
