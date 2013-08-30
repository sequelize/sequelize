/* jshint camelcase: false */
var chai            = require('chai')
  , expect          = chai.expect
  , QueryGenerator  = require("../../lib/dialects/postgres/query-generator")
  , Support         = require(__dirname + '/../support')
  , dialect         = Support.getTestDialect()
  , DataTypes       = require(__dirname + "/../../lib/data-types")
  , moment          = require('moment')
  , util            = require("util")
  , _               = require('lodash')

chai.Assertion.includeStack = true

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] QueryGenerator', function() {
    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        email: {type: DataTypes.ARRAY(DataTypes.TEXT)},
        document: {type: DataTypes.HSTORE, defaultValue: '"default"=>"value"'}
      })
      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

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
          arguments: [{id: {type: 'INTEGER', comment: "I'm a comment!" }}],
          expectation: {id: "INTEGER COMMENT ON COLUMN <%= table %>.\"id\" IS 'I''m a comment!'" }
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
        },

      ],

      createTableQuery: [
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));",
        },
        {
          arguments: ['myTable', {title: "INTEGER COMMENT ON COLUMN <%= table %>.\"title\" IS 'I''m a comment!'"}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" INTEGER ); COMMENT ON COLUMN \"myTable\".\"title\" IS 'I''m a comment!';",
        },
        {
          arguments: ['myTable', {title: "INTEGER"}, {comment: "I'm a comment!"}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" INTEGER); COMMENT ON TABLE \"myTable\" IS 'I''m a comment!';",
        },
        {
          arguments: ['myTable', {data: "BLOB"}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" bytea);"
        },
        {
          arguments: ['myTable', {data: "LONGBLOB"}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"data\" bytea);"
        },
        {
          arguments: ['mySchema.myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS \"mySchema\".\"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255));"
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" \"enum_myTable_title\", \"name\" VARCHAR(255));"
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"id\" INTEGER , PRIMARY KEY (\"id\"));"
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: "CREATE TABLE IF NOT EXISTS \"myTable\" (\"title\" VARCHAR(255), \"name\" VARCHAR(255), \"otherId\" INTEGER REFERENCES \"otherTable\" (\"id\") ON DELETE CASCADE ON UPDATE NO ACTION);"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['mySchema.myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS mySchema.myTable (title VARCHAR(255), name VARCHAR(255));",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)'}],
          expectation: "CREATE TABLE IF NOT EXISTS myTable (title enum_myTable_title, name VARCHAR(255));",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY'}],
          expectation: "CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), id INTEGER , PRIMARY KEY (id));",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION'}],
          expectation: "CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), otherId INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      dropTableQuery: [
        {
          arguments: ['myTable'],
          expectation: "DROP TABLE IF EXISTS \"myTable\";"
        },
        {
          arguments: ['mySchema.myTable'],
          expectation: "DROP TABLE IF EXISTS \"mySchema\".\"myTable\";"
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: "DROP TABLE IF EXISTS \"myTable\" CASCADE;"
        },
        {
          arguments: ['mySchema.myTable', {cascade: true}],
          expectation: "DROP TABLE IF EXISTS \"mySchema\".\"myTable\" CASCADE;"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: "DROP TABLE IF EXISTS myTable;",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['mySchema.myTable'],
          expectation: "DROP TABLE IF EXISTS mySchema.myTable;",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['myTable', {cascade: true}],
          expectation: "DROP TABLE IF EXISTS myTable CASCADE;",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: ['mySchema.myTable', {cascade: true}],
          expectation: "DROP TABLE IF EXISTS mySchema.myTable CASCADE;",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: "SELECT * FROM \"myTable\";"
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: "SELECT \"id\", \"name\" FROM \"myTable\";"
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\"=2;"
        }, {
          arguments: ['myTable', {where: {name: 'foo'}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\"='foo';"
        }, {
          arguments: ['myTable', {where: {name: "foo';DROP TABLE myTable;"}}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"name\"='foo'';DROP TABLE myTable;';"
        }, {
          arguments: ['myTable', {where: 2}],
          expectation: "SELECT * FROM \"myTable\" WHERE \"myTable\".\"id\"=2;"
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) as \"count\" FROM \"foo\";'
        }, {
          arguments: ['myTable', {where: "foo='bar'"}],
          expectation: "SELECT * FROM \"myTable\" WHERE foo='bar';"
        }, {
          arguments: ['myTable', {order: "id DESC"}],
          expectation: "SELECT * FROM \"myTable\" ORDER BY \"id\" DESC;"
        }, {
          arguments: ['myTable', {group: "name"}],
          expectation: "SELECT * FROM \"myTable\" GROUP BY \"name\";"
        }, {
          arguments: ['myTable', {group: ["name"]}],
          expectation: "SELECT * FROM \"myTable\" GROUP BY \"name\";"
        }, {
          arguments: ['myTable', {group: ["name","title"]}],
          expectation: "SELECT * FROM \"myTable\" GROUP BY \"name\", \"title\";"
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: "SELECT * FROM \"myTable\" LIMIT 10;"
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: "SELECT * FROM \"myTable\" LIMIT 10 OFFSET 2;"
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: "SELECT * FROM \"myTable\" OFFSET 2;"
        }, {
          arguments: ['mySchema.myTable'],
          expectation: "SELECT * FROM \"mySchema\".\"myTable\";"
        }, {
          arguments: ['mySchema.myTable', {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM \"mySchema\".\"myTable\" WHERE \"mySchema\".\"myTable\".\"name\"='foo'';DROP TABLE mySchema.myTable;';"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: "SELECT * FROM myTable;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {attributes: ['id', 'name']}],
          expectation: "SELECT id, name FROM myTable;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: {id: 2}}],
          expectation: "SELECT * FROM myTable WHERE myTable.id=2;",
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
          expectation: "SELECT * FROM myTable WHERE myTable.id=2;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['foo', { attributes: [['count(*)', 'count']] }],
          expectation: 'SELECT count(*) as count FROM foo;',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {where: "foo='bar'"}],
          expectation: "SELECT * FROM myTable WHERE foo='bar';",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {order: "id DESC"}],
          expectation: "SELECT * FROM myTable ORDER BY id DESC;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: "name"}],
          expectation: "SELECT * FROM myTable GROUP BY name;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ["name"]}],
          expectation: "SELECT * FROM myTable GROUP BY name;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {group: ["name","title"]}],
          expectation: "SELECT * FROM myTable GROUP BY name, title;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10}],
          expectation: "SELECT * FROM myTable LIMIT 10;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {limit: 10, offset: 2}],
          expectation: "SELECT * FROM myTable LIMIT 10 OFFSET 2;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          title: 'uses offset even if no limit was passed',
          arguments: ['myTable', {offset: 2}],
          expectation: "SELECT * FROM myTable OFFSET 2;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable'],
          expectation: "SELECT * FROM mySchema.myTable;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {where: {name: "foo';DROP TABLE mySchema.myTable;"}}],
          expectation: "SELECT * FROM mySchema.myTable WHERE mySchema.myTable.name='foo'';DROP TABLE mySchema.myTable;';",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      insertQuery: [
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') RETURNING *;"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;') RETURNING *;"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00') RETURNING *;"
        }, {
          arguments: ['myTable', {data: new Buffer('Sequelize') }],
          expectation: "INSERT INTO \"myTable\" (\"data\") VALUES (E'\\\\x53657175656c697a65') RETURNING *;"
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1) RETURNING *;"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL) RETURNING *;"
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL) RETURNING *;",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') RETURNING *;",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo') RETURNING *;",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['mySchema.myTable', {name: 'foo'}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo') RETURNING *;"
        }, {
          arguments: ['mySchema.myTable', {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}') RETURNING *;"
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;') RETURNING *;"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', foo: 1}],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1) RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL) RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL) RETURNING *;",
          context: {options: {omitNull: false, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: null}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo') RETURNING *;",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', nullValue: undefined}],
          expectation: "INSERT INTO myTable (name) VALUES ('foo') RETURNING *;",
          context: {options: {omitNull: true, quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: 'foo'}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: JSON.stringify({info: 'Look ma a " quote'})}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }

      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'),('bar') RETURNING *;"
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"myTable\" (\"name\") VALUES ('foo'';DROP TABLE myTable;'),('bar') RETURNING *;"
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {name: 'bar', birthday: moment("2012-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"birthday\") VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00') RETURNING *;"
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"foo\") VALUES ('foo',1),('bar',2) RETURNING *;"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL) RETURNING *;"
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {omitNull: true}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO \"myTable\" (\"name\",\"nullValue\") VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {omitNull: true}} // Note: As above
        }, {
          arguments: ['mySchema.myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'),('bar') RETURNING *;"
        }, {
          arguments: ['mySchema.myTable', [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}') RETURNING *;"
        }, {
          arguments: ['mySchema.myTable', [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO \"mySchema\".\"myTable\" (\"name\") VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar') RETURNING *;"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'),('bar') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: "foo';DROP TABLE myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO myTable (name) VALUES ('foo'';DROP TABLE myTable;'),('bar') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {name: 'bar', birthday: moment("2012-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}]],
          expectation: "INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000 +00:00'),('bar','2012-03-27 10:01:55.000 +00:00') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', foo: 1}, {name: 'bar', foo: 2}]],
          expectation: "INSERT INTO myTable (name,foo) VALUES ('foo',1),('bar',2) RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {quoteIdentifiers: false, omitNull: false}},
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: null}, {name: 'bar', nullValue: null}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{name: 'foo', nullValue: undefined}, {name: 'bar', nullValue: undefined}]],
          expectation: "INSERT INTO myTable (name,nullValue) VALUES ('foo',NULL),('bar',NULL) RETURNING *;",
          context: {options: {omitNull: true, quoteIdentifiers: false}} // Note: As above
        }, {
          arguments: ['mySchema.myTable', [{name: 'foo'}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'),('bar') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', [{name: JSON.stringify({info: 'Look ma a " quote'})}, {name: JSON.stringify({info: 'Look ma another " quote'})}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('{\"info\":\"Look ma a \\\" quote\"}'),('{\"info\":\"Look ma another \\\" quote\"}') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', [{name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'bar'}]],
          expectation: "INSERT INTO mySchema.myTable (name) VALUES ('foo'';DROP TABLE mySchema.myTable;'),('bar') RETURNING *;",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      updateQuery: [
        {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {id: 2}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2 RETURNING *"
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, 2],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2 RETURNING *"
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo' RETURNING *"
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"name\"='foo'';DROP TABLE myTable;' WHERE \"name\"='foo' RETURNING *"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\"='foo' RETURNING *"
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2,\"nullValue\"=NULL WHERE \"name\"='foo' RETURNING *",
          context: {options: {omitNull: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo' RETURNING *",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE \"myTable\" SET \"bar\"=2 WHERE \"name\"='foo' RETURNING *",
          context: {options: {omitNull: true}}
        }, {
          arguments: ['mySchema.myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {id: 2}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo',\"birthday\"='2011-03-27 10:01:55.000 +00:00' WHERE \"id\"=2 RETURNING *"
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE \"mySchema\".\"myTable\" SET \"name\"='foo'';DROP TABLE mySchema.myTable;' WHERE \"name\"='foo' RETURNING *"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {id: 2}],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2 RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, 2],
          expectation: "UPDATE myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2 RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo' RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {name: "foo';DROP TABLE myTable;"}, {name: 'foo'}],
          expectation: "UPDATE myTable SET name='foo'';DROP TABLE myTable;' WHERE name='foo' RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name='foo' RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2,nullValue=NULL WHERE name='foo' RETURNING *",
          context: {options: {omitNull: false, quoteIdentifiers: false}},
        }, {
          arguments: ['myTable', {bar: 2, nullValue: null}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo' RETURNING *",
          context: {options: {omitNull: true, quoteIdentifiers: false}},
        }, {
          arguments: ['myTable', {bar: 2, nullValue: undefined}, {name: 'foo'}],
          expectation: "UPDATE myTable SET bar=2 WHERE name='foo' RETURNING *",
          context: {options: {omitNull: true, quoteIdentifiers: false}},
        }, {
          arguments: ['mySchema.myTable', {name: 'foo', birthday: moment("2011-03-27 10:01:55 +0000", "YYYY-MM-DD HH:mm:ss Z").toDate()}, {id: 2}],
          expectation: "UPDATE mySchema.myTable SET name='foo',birthday='2011-03-27 10:01:55.000 +00:00' WHERE id=2 RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.myTable', {name: "foo';DROP TABLE mySchema.myTable;"}, {name: 'foo'}],
          expectation: "UPDATE mySchema.myTable SET name='foo'';DROP TABLE mySchema.myTable;' WHERE name='foo' RETURNING *",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      deleteQuery: [
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"name\"='foo' LIMIT 1)"
        }, {
          arguments: ['myTable', 1],
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"id\"=1 LIMIT 1)"
        }, {
          arguments: ['myTable', undefined, {truncate: true}],
          expectation: "TRUNCATE \"myTable\""
        }, {
          arguments: ['myTable', 1, {limit: 10, truncate: true}],
          expectation: "TRUNCATE \"myTable\""
        }, {
          arguments: ['myTable', 1, {limit: 10}],
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"id\"=1 LIMIT 10)"
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
          expectation: "DELETE FROM \"myTable\" WHERE \"id\" IN (SELECT \"id\" FROM \"myTable\" WHERE \"name\"='foo')"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', {name: 'foo'}],
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE name='foo' LIMIT 1)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', 1],
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE id=1 LIMIT 1)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['myTable', 1, {limit: 10}],
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE id=1 LIMIT 10)",
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
          expectation: "DELETE FROM myTable WHERE id IN (SELECT id FROM myTable WHERE name='foo')",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      addIndexQuery: [
        {
          arguments: ['User', ['username', 'isAdmin']],
          expectation: 'CREATE INDEX \"user_username_is_admin\" ON \"User\" (\"username\", \"isAdmin\")'
        }, {
          arguments: [
            'User', [
              { attribute: 'username', length: 10, order: 'ASC'},
              'isAdmin'
            ]
          ],
          expectation: "CREATE INDEX \"user_username_is_admin\" ON \"User\" (\"username\"(10) ASC, \"isAdmin\")"
        }, {
          arguments: [
            'User', ['username', 'isAdmin'], { indicesType: 'FULLTEXT', indexName: 'bar'}
          ],
          expectation: "CREATE FULLTEXT INDEX \"bar\" ON \"User\" (\"username\", \"isAdmin\")"
        }, {
          arguments: ['mySchema.User', ['username', 'isAdmin']],
          expectation: 'CREATE INDEX \"user_username_is_admin\" ON \"mySchema\".\"User\" (\"username\", \"isAdmin\")'
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', ['username', 'isAdmin']],
          expectation: 'CREATE INDEX user_username_is_admin ON User (username, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [
            'User', [
              { attribute: 'username', length: 10, order: 'ASC'},
              'isAdmin'
            ]
          ],
          expectation: "CREATE INDEX user_username_is_admin ON User (username(10) ASC, isAdmin)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: [
            'User', ['username', 'isAdmin'], { indicesType: 'FULLTEXT', indexName: 'bar'}
          ],
          expectation: "CREATE FULLTEXT INDEX bar ON User (username, isAdmin)",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['mySchema.User', ['username', 'isAdmin']],
          expectation: 'CREATE INDEX user_username_is_admin ON mySchema.User (username, isAdmin)',
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      // FIXME: not implemented
      //showIndexQuery: [
      //  {
      //    arguments: ['User'],
      //    expectation: 'SHOW INDEX FROM \"User\"'
      //  }, {
      //    arguments: ['User', { database: 'sequelize' }],
      //    expectation: "SHOW INDEX FROM \"User\" FROM \"sequelize\""
      //  }
      //],

      removeIndexQuery: [
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: "DROP INDEX IF EXISTS \"user_foo_bar\""
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: "DROP INDEX IF EXISTS \"user_foo_bar\""
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: "DROP INDEX IF EXISTS \"mySchema\".\"user_foo_bar\""
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', 'user_foo_bar'],
          expectation: "DROP INDEX IF EXISTS user_foo_bar",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', ['foo', 'bar']],
          expectation: "DROP INDEX IF EXISTS user_foo_bar",
          context: {options: {quoteIdentifiers: false}}
        }, {
          arguments: ['User', 'mySchema.user_foo_bar'],
          expectation: "DROP INDEX IF EXISTS mySchema.user_foo_bar",
          context: {options: {quoteIdentifiers: false}}
        }
      ],

      hashToWhereConditions: [
        {
          arguments: [{ id: [1,2,3] }],
          expectation: "\"id\" IN (1,2,3)"
        },
        {
          arguments: [{ id: [] }],
          expectation: "\"id\" IN (NULL)"
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{ id: [1,2,3] }],
          expectation: "id IN (1,2,3)",
          context: {options: {quoteIdentifiers: false}}
        },
        {
          arguments: [{ id: [] }],
          expectation: "id IN (NULL)",
          context: {options: {quoteIdentifiers: false}}
        },
      ]
    }

    _.each(suites, function(tests, suiteTitle) {
      describe(suiteTitle, function() {
        afterEach(function(done) {
          this.sequelize.options.quoteIdentifiers = true
          QueryGenerator.options.quoteIdentifiers = true
          done()
        })

        tests.forEach(function(test) {
          var title = test.title || 'Postgres correctly returns ' + test.expectation + ' for ' + util.inspect(test.arguments)
          it(title, function(done) {
            // Options would normally be set by the query interface that instantiates the query-generator, but here we specify it explicitly
            var context = test.context || {options: {}};
            QueryGenerator.options = context.options
            var conditions = QueryGenerator[suiteTitle].apply(QueryGenerator, test.arguments)
            expect(conditions).to.deep.equal(test.expectation)
            done()
          })
        })
      })
    })
  })
}