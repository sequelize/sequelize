'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , _ = require('lodash')
  , count = 0
  , log = function (sql) {
    // sqlite fires a lot more querys than the other dbs. this is just a simple hack, since i'm lazy
    if (dialect !== 'sqlite' || count === 0) {
      count++;
    }
  };

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('QueryInterface'), function() {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  describe('dropAllTables', function() {
    it('should drop all tables', function() {
      var self = this;
      return this.queryInterface.dropAllTables().then(function() {
        return self.queryInterface.showAllTables({logging: log}).then(function(tableNames) {
          expect(count).to.be.equal(1);
          count = 0;
          expect(tableNames).to.be.empty;
          return self.queryInterface.createTable('table', { name: DataTypes.STRING }, {
            logging: log
          }).then(function() {
            expect(count).to.be.equal(1);
            count = 0;
            return self.queryInterface.showAllTables({logging: log}).then(function(tableNames) {
              expect(count).to.be.equal(1);
              count = 0;
              expect(tableNames).to.have.length(1);
              return self.queryInterface.dropAllTables({logging: log}).then(function() {
                expect(count).to.be.equal(1);
                count = 0;
                return self.queryInterface.showAllTables().then(function(tableNames) {
                  expect(tableNames).to.be.empty;
                });
              });
            });
          });
        });
      });
    });

    it('should be able to skip given tables', function() {
      var self = this;
      return self.queryInterface.createTable('skipme', {
        name: DataTypes.STRING
      }).then(function() {
        return self.queryInterface.dropAllTables({skip: ['skipme']}).then(function() {
          return self.queryInterface.showAllTables().then(function(tableNames) {
            if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
              tableNames = _.pluck(tableNames, 'tableName');
            }
            expect(tableNames).to.contain('skipme');
          });
        });
      });
    });
  });

  describe('indexes', function() {
    beforeEach(function() {
      var self = this;
      return this.queryInterface.dropTable('Group', {logging: log}).then(function() {
        expect(count).to.be.equal(1);
        count = 0;
        return self.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        });
      });
    });

    it('adds, reads and removes an index to the table', function() {
      var self = this;
      return this.queryInterface.addIndex('Group', ['username', 'isAdmin'], {
        logging: log
      }).then(function() {
        expect(count).to.be.equal(1);
        count = 0;
        return self.queryInterface.showIndex('Group', {logging: log}).then(function(indexes) {
          expect(count).to.be.equal(1);
          count = 0;

          var indexColumns = _.uniq(indexes.map(function(index) { return index.name; }));
          expect(indexColumns).to.include('group_username_is_admin');
          return self.queryInterface.removeIndex('Group', ['username', 'isAdmin'], {logging: log}).then(function() {
            expect(count).to.be.equal(1);
            count = 0;
            return self.queryInterface.showIndex('Group').then(function(indexes) {
              indexColumns = _.uniq(indexes.map(function(index) { return index.name; }));
              expect(indexColumns).to.be.empty;
            });
          });
        });
      });
    });

    it('does not fail on reserved keywords', function() {
      return this.queryInterface.addIndex('Group', ['from']);
    });
  });

  describe('describeTable', function() {
    it('reads the metadata of the table', function() {
      var self = this;
      var Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.describeTable('_Users', {logging: log}).then(function(metadata) {
          expect(count).to.be.equal(1);
          count = 0;

          var username = metadata.username;
          var isAdmin = metadata.isAdmin;
          var enumVals = metadata.enumVals;

          var assertVal = 'VARCHAR(255)';
          switch (dialect) {
            case 'postgres':
              assertVal = 'CHARACTER VARYING';
              break;
            case 'mssql':
              assertVal = 'NVARCHAR';
              break;
          }
          expect(username.type).to.equal(assertVal);
          expect(username.allowNull).to.be.true;
          expect(username.defaultValue).to.be.null;

          assertVal = 'TINYINT(1)';
          switch (dialect) {
            case 'postgres':
              assertVal = 'BOOLEAN';
              break;
            case 'mssql':
              assertVal = 'BIT';
              break;
          }
          expect(isAdmin.type).to.equal(assertVal);
          expect(isAdmin.allowNull).to.be.true;
          expect(isAdmin.defaultValue).to.be.null;

          if (dialect === 'postgres' || dialect === 'postgres-native') {
            expect(enumVals.special).to.be.instanceof(Array);
            expect(enumVals.special).to.have.length(2);
          }
        });
      });
    });
  });

  describe('createTable', function() {
    it('should create a auto increment primary key', function() {
      return this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).bind(this).then(function() {
        return this.queryInterface.insert(null, 'TableWithPK', {}, {raw: true, returning: true, plain: true}).then(function(response) {
          expect(response.table_id || (typeof response !== 'object' && response)).to.be.ok;
        });
      });
    });

    it('should work with enums (1)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: DataTypes.ENUM('value1', 'value2', 'value3')
      });
    });

    it('should work with enums (2)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        }
      });
    });

    it('should work with enums (3)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3'],
          field: 'otherName'
        }
      });
    });


    it('should work with schemas', function() {
      var self = this;
      return self.sequelize.dropAllSchemas({logging: log}).then(function() {
        // TODO: FIXME: somehow these do not fire the logging function
        if (dialect !== 'mysql' && dialect !== 'sqlite' && dialect !== 'mariadb') {
          expect(count).to.be.above(0);
        }
        count = 0;
        return self.sequelize.createSchema('hero', {logging: log});
      }).then(function() {
        expect(count).to.be.equal(1);
        count = 0;
        return self.queryInterface.createTable('User', {
          name: {
            type: DataTypes.STRING
          }
        }, {
          schema: 'hero'
        });
      }).then(function() {
        return self.queryInterface.rawSelect('User', {
          schema: 'hero',
          logging: log
        }, 'name');
      }).then(function() {
        expect(count).to.be.equal(1);
        count = 0;
      });
    });
  });

  describe('renameColumn', function() {
    it('rename a simple column', function() {
      var self = this;
      var Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo', {logging: log}).then(function() {
          if (dialect === 'sqlite')
            count++;
          expect(count).to.be.equal(2);
          count = 0;
        });
      });
    });

    it('works with schemas', function() {
      var self = this;
      var Users = self.sequelize.define('User', {
        username: DataTypes.STRING
      }, {
        tableName: 'Users',
        schema: 'archive'
      });

      return self.sequelize.dropAllSchemas().then(function() {
        return self.sequelize.createSchema('archive');
      }).then(function() {
        return Users.sync({ force: true }).then(function() {
          return self.queryInterface.renameColumn({
            schema: 'archive',
            tableName: 'Users'
          }, 'username', 'pseudo');
        });
      });
    });

    it('rename a column non-null without default value', function() {
      var self = this;
      var Users = self.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      });
    });

    it('rename a boolean column non-null without default value', function() {
      var self = this;
      var Users = self.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'active', 'enabled');
      });
    });

    it('renames a column primary key autoIncrement column', function() {
      var self = this;
      var Fruits = self.sequelize.define('Fruit', {
        fruitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }, { freezeTableName: true });

      return Fruits.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
      });
    });
  });

  describe('changeColumn', function() {
    it('should support schemas', function() {
      return this.sequelize.dropAllSchemas().bind(this).then(function() {
        return this.sequelize.createSchema('archive');
      }).then(function() {
        return this.queryInterface.createTable({
          tableName: 'users',
          schema: 'archive'
        }, {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          currency: DataTypes.INTEGER
        }).bind(this).then(function() {
          return this.queryInterface.changeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'currency', {
            type: DataTypes.FLOAT
          }, {
            logging: log
          }).then(function() {
            expect(count).to.be.equal(1);
            count = 0;
          });
        });
      });
    });
  });

  describe('addColumn', function() {
    beforeEach(function() {
      return this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
    });

    it('should be able to add a foreign key reference', function() {
      return this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).bind(this).then(function() {
        return this.queryInterface.addColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: 'level',
          referenceKey: 'id',
          onUpdate: 'cascade',
          onDelete: 'set null'
        }, {logging: log});
      }).then(function() {
        expect(count).to.be.equal(1);
        count = 0;
      });
    });

    it('should work with schemas', function() {
      return this.queryInterface.createTable({
        tableName: 'users',
        schema: 'archive'
      }, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).bind(this).then(function() {
        return this.queryInterface.addColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'level_id', {
          type: DataTypes.INTEGER
        });
      });
    });

    it('should work with enums (1)', function() {
      return this.queryInterface.addColumn('users', 'someEnum', DataTypes.ENUM('value1', 'value2', 'value3'));
    });

    it('should work with enums (2)', function() {
      return this.queryInterface.addColumn('users', 'someOtherEnum', {
        type: DataTypes.ENUM,
        values: ['value1', 'value2', 'value3']
      });
    });
  });

  describe('describeForeignKeys', function() {
    beforeEach(function() {
      return this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).bind(this).then(function() {
        return this.queryInterface.createTable('hosts', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          admin: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id'
          },
          operator: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id',
            onUpdate: 'cascade'
          },
          owner: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id',
            onUpdate: 'cascade',
            onDelete: 'set null'
          }
        });
      });
    });

    it('should get a list of foreign keys for the table', function() {
      var sql = this.queryInterface.QueryGenerator.getForeignKeysQuery('hosts', this.sequelize.config.database);

      return this.sequelize.query(sql, {type: this.sequelize.QueryTypes.FOREIGNKEYS, logging: log}).then(function(fks) {
        expect(count).to.be.equal(1);
        expect(fks).to.have.length(3);
        count = 0;
        var keys = Object.keys(fks[0]),
          keys2 = Object.keys(fks[1]),
          keys3 = Object.keys(fks[2]);

        if (dialect === 'postgres' || dialect === 'postgres-native') {
          expect(keys).to.have.length(6);
          expect(keys2).to.have.length(7);
          expect(keys3).to.have.length(7);
        } else if (dialect === 'sqlite') {
          expect(keys).to.have.length(8);
        } else if (dialect === 'mysql' || dialect === 'mssql') {
          expect(keys).to.have.length(1);
        } else {
          console.log('This test doesn\'t support ' + dialect);
        }
      });
    });
  });
});
