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

describe(Support.getTestDialectTeaser('QueryInterface'), function() {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return this.sequelize.dropAllSchemas();
  });

  describe('dropAllTables', function() {
    it('should drop all tables', function() {
      function filterMSSQLDefault(tableNames) {
        return tableNames.filter(function (t) {
          return t.tableName !== 'spt_values';
        });
      }
      var self = this;
      return this.queryInterface.dropAllTables().then(function() {
        return self.queryInterface.showAllTables().then(function(tableNames) {
          // MSSQL include spt_values table which is system defined, hence cant be dropped
          tableNames = filterMSSQLDefault(tableNames);
          expect(tableNames).to.be.empty;
          return self.queryInterface.createTable('table', { name: DataTypes.STRING }).then(function() {
            return self.queryInterface.showAllTables().then(function(tableNames) {
              tableNames = filterMSSQLDefault(tableNames);
              expect(tableNames).to.have.length(1);
              return self.queryInterface.dropAllTables().then(function() {
                return self.queryInterface.showAllTables().then(function(tableNames) {
                  // MSSQL include spt_values table which is system defined, hence cant be dropped
                  tableNames = filterMSSQLDefault(tableNames);
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
              tableNames = _.map(tableNames, 'tableName');
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
      return this.queryInterface.dropTable('Group').then(function() {
        return self.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        });
      });
    });

    it('adds, reads and removes an index to the table', function() {
      var self = this;
      return this.queryInterface.addIndex('Group', ['username', 'isAdmin']).then(function() {
        return self.queryInterface.showIndex('Group').then(function(indexes) {
          var indexColumns = _.uniq(indexes.map(function(index) { return index.name; }));
          expect(indexColumns).to.include('group_username_is_admin');
          return self.queryInterface.removeIndex('Group', ['username', 'isAdmin']).then(function() {
            return self.queryInterface.showIndex('Group').then(function(indexes) {
              indexColumns = _.uniq(indexes.map(function(index) { return index.name; }));
              expect(indexColumns).to.be.empty;
            });
          });
        });
      });
    });

    it('works with schemas', function() {
      var self = this;
      return self.sequelize.createSchema('schema').then(function() {
        return self.queryInterface.createTable('table', {
          name: {
            type: DataTypes.STRING
          },
          isAdmin: {
            type: DataTypes.STRING
          }
        }, {
          schema: 'schema'
        });
      }).then(function() {
        return self.queryInterface.addIndex({
          schema: 'schema',
          tableName: 'table'
        }, ['name', 'isAdmin'], null, 'schema_table').then(function() {
            return self.queryInterface.showIndex({
              schema: 'schema',
              tableName: 'table'
            }).then(function(indexes) {
              expect(indexes.length).to.eq(1);
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
        city: {
          type: DataTypes.STRING,
          defaultValue: null
        },
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.describeTable('_Users').then(function(metadata) {
          var id = metadata.id;
          var username = metadata.username;
          var city = metadata.city;
          var isAdmin = metadata.isAdmin;
          var enumVals = metadata.enumVals;

          expect(id.primaryKey).to.be.ok;

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

          switch (dialect) {
            case 'sqlite':
              expect(username.defaultValue).to.be.undefined;
              break;
            default:
              expect(username.defaultValue).to.be.null;
          }

          switch (dialect) {
            case 'sqlite':
              expect(city.defaultValue).to.be.null;
              break;
          }

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
          switch (dialect) {
            case 'sqlite':
              expect(isAdmin.defaultValue).to.be.undefined;
              break;
            default:
              expect(isAdmin.defaultValue).to.be.null;
          }

          if (dialect === 'postgres' || dialect === 'postgres-native') {
            expect(enumVals.special).to.be.instanceof(Array);
            expect(enumVals.special).to.have.length(2);
          } else if (dialect === 'mysql') {
            expect(enumVals.type).to.eql('ENUM(\'hello\',\'world\')');
          }
        });
      });
    });
  });

  // FIXME: These tests should make assertions against the created table using describeTable
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
      return self.sequelize.createSchema('hero').then(function() {
        return self.queryInterface.createTable('User', {
          name: {
            type: DataTypes.STRING
          }
        }, {
          schema: 'hero'
        });
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
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(function (table) {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('works with schemas', function() {
      var self = this;
      return self.sequelize.createSchema('archive').then(function() {
        var Users = self.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          tableName: 'Users',
          schema: 'archive'
        });
        return Users.sync({ force: true }).then(function() {
          return self.queryInterface.renameColumn({
            schema: 'archive',
            tableName: 'Users'
          }, 'username', 'pseudo');
        });
      }).bind(this).then(function() {
        return this.queryInterface.describeTable({
          schema: 'archive',
          tableName: 'Users'
        });
      }).then(function (table) {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
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
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(function (table) {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
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
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(function (table) {
        expect(table).to.have.property('enabled');
        expect(table).to.not.have.property('active');
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
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('Fruit');
      }).then(function (table) {
        expect(table).to.have.property('fruit_id');
        expect(table).to.not.have.property('fruitId');
      });
    });
  });

  describe('changeColumn', function() {
    it('should support schemas', function() {
      return this.sequelize.createSchema('archive').bind(this).then(function() {
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
          });
        }).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(function (table) {
          if (dialect === 'postgres' || dialect === 'postgres-native') {
            expect(table.currency.type).to.equal('DOUBLE PRECISION');
          } else {
            expect(table.currency.type).to.equal('FLOAT');
          }
        });
      });
    });

    it('should change columns', function() {
        return this.queryInterface.createTable({
          tableName: 'users'
        }, {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          currency: DataTypes.INTEGER
        }).bind(this).then(function() {
          return this.queryInterface.changeColumn('users', 'currency', {
            type: DataTypes.FLOAT,
            allowNull: true
          });
        }).then(function() {
            return this.queryInterface.describeTable({
              tableName: 'users'
            });
        }).then(function (table) {
          if (dialect === 'postgres' || dialect === 'postgres-native') {
            expect(table.currency.type).to.equal('DOUBLE PRECISION');
          } else {
            expect(table.currency.type).to.equal('FLOAT');
          }
        });
      });
    });

    //SQlite navitely doesnt support ALTER Foreign key
    if (dialect !== 'sqlite') {
      describe('should support foreign keys', function() {
        beforeEach(function() {
          return this.queryInterface.createTable('users', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false
            }
          })
          .bind(this).then(function() {
            return this.queryInterface.createTable('level', {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              }
            });
          });
        });

        it('able to change column to foreign key', function() {
          return this.queryInterface.changeColumn('users', 'level_id', {
            type: DataTypes.INTEGER,
            references: {
              model: 'level',
              key:   'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          }, {logging: log}).then(function() {
            expect(count).to.be.equal(1);
            count = 0;
          });
        });

      });
    }

  describe('addColumn', function() {
    beforeEach(function() {
      return this.sequelize.createSchema('archive').bind(this).then(function() {
        return this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        });
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
          references: {
            model: 'level',
            key:   'id'
          },
          onUpdate: 'cascade',
          onDelete: 'set null'
        });
      }).then(function() {
        return this.queryInterface.describeTable('users');
      }).then(function (table) {
        expect(table).to.have.property('level_id');
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
        }).bind(this).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(function (table) {
          expect(table).to.have.property('level_id');
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

  describe('removeColumn', function() {
    describe('(without a schema)', function() {
      beforeEach(function() {
        return this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          firstName: {
            type: DataTypes.STRING,
            defaultValue: 'Someone'
          },
          lastName: {
            type: DataTypes.STRING
          },
          manager: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key:   'id'
            }
          }
        });
      });

      it('should be able to remove a column with a default value', function() {
        return this.queryInterface.removeColumn('users', 'firstName').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
            expect(table).to.not.have.property('firstName');
        });
      });

      it('should be able to remove a column without default value', function() {
        return this.queryInterface.removeColumn('users', 'lastName').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
          expect(table).to.not.have.property('lastName');
        });
      });

      it('should be able to remove a column with a foreign key constraint', function() {
        return this.queryInterface.removeColumn('users', 'manager').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
            expect(table).to.not.have.property('manager');
        });
      });

      it('should be able to remove a column with primaryKey', function () {
        return this.queryInterface.removeColumn('users', 'manager').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
          expect(table).to.not.have.property('manager');
          return this.queryInterface.removeColumn('users', 'id');
        }).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
          expect(table).to.not.have.property('id');
        });
      });
    });

    describe('(with a schema)', function() {
      beforeEach(function() {
        return this.sequelize.createSchema('archive').bind(this).then(function() {
          return this.queryInterface.createTable({
            tableName: 'users',
            schema: 'archive'
          }, {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            firstName: {
              type: DataTypes.STRING,
              defaultValue: 'Someone'
            },
            lastName: {
              type: DataTypes.STRING
            }
          });
        });
      });

      it('should be able to remove a column with a default value', function() {
        return this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'firstName'
        ).bind(this).then(function() {
            return this.queryInterface.describeTable({
              tableName: 'users',
              schema: 'archive'
            });
          }).then(function(table) {
            expect(table).to.not.have.property('firstName');
          });
      });

      it('should be able to remove a column without default value', function() {
        return this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'lastName'
        ).bind(this).then(function() {
            return this.queryInterface.describeTable({
              tableName: 'users',
              schema: 'archive'
            });
          }).then(function(table) {
            expect(table).to.not.have.property('lastName');
          });
      });

      it('should be able to remove a column with primaryKey', function () {
        return this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'id').bind(this).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(function(table) {
          expect(table).to.not.have.property('id');
        });
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
            references: {
              model: 'users',
              key:   'id'
            }
          },
          operator: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key:   'id'
            },
            onUpdate: 'cascade'
          },
          owner: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key:   'id'
            },
            onUpdate: 'cascade',
            onDelete: 'set null'
          }
        });
      });
    });

    it('should get a list of foreign keys for the table', function() {
      var sql = this.queryInterface.QueryGenerator.getForeignKeysQuery('hosts', this.sequelize.config.database);
      var self = this;
      return this.sequelize.query(sql, {type: this.sequelize.QueryTypes.FOREIGNKEYS}).then(function(fks) {
        expect(fks).to.have.length(3);
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
        return fks;
      }).then(function(fks){
        if (dialect === 'mysql') {
          return self.sequelize.query(
              self.queryInterface.QueryGenerator.getForeignKeyQuery('hosts', 'admin'),
              {}
            )
            .spread(function(fk){
              expect(fks[0]).to.deep.eql(fk[0]);
            });
        }
        return;
      });
    });
  });
});
