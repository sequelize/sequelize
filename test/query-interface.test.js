var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')

chai.config.includeStack = true

describe(Support.getTestDialectTeaser("QueryInterface"), function () {
  beforeEach(function(done) {
    this.sequelize.options.quoteIdenifiers = true
    this.queryInterface = this.sequelize.getQueryInterface()
    done()
  })

  describe('dropAllTables', function() {
    it("should drop all tables", function(done) {
      var self = this
      this.queryInterface.dropAllTables().complete(function(err) {
        expect(err).to.be.null

        self.queryInterface.showAllTables().complete(function(err, tableNames) {
          expect(err).to.be.null
          expect(tableNames).to.be.empty

          self.queryInterface.createTable('table', { name: DataTypes.STRING }).complete(function(err) {
            expect(err).to.be.null

            self.queryInterface.showAllTables().complete(function(err, tableNames) {
              expect(err).to.be.null
              expect(tableNames).to.have.length(1)

              self.queryInterface.dropAllTables().complete(function(err) {
                expect(err).to.be.null

                self.queryInterface.showAllTables().complete(function(err, tableNames) {
                  expect(err).to.be.null
                  expect(tableNames).to.be.empty
                  done()
                })
              })
            })
          })
        })
      })
    })

    it('should be able to skip given tables', function(done){
      var self = this
      self.queryInterface.createTable('skipme', {
        name: DataTypes.STRING,
      }).success(function() {
        self.queryInterface.dropAllTables({skip: ['skipme']}).complete(function(err){
          expect(err).to.be.null

          self.queryInterface.showAllTables().complete(function(err, tableNames) {
            expect(err).to.be.null

            expect(tableNames).to.contain('skipme');
            done();
          })
        })
      })
    })
  })

  describe('indexes', function() {
    beforeEach(function(done) {
      var self = this
      this.queryInterface.dropTable('Group').success(function() {
        self.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        }).success(function() {
          done()
        })
      })
    })

    it('adds, reads and removes an index to the table', function(done) {
      var self = this

      this.queryInterface.addIndex('Group', ['username', 'isAdmin']).complete(function(err) {
        expect(err).to.be.null

        self.queryInterface.showIndex('Group').complete(function(err, indexes) {
          expect(err).to.be.null

          var indexColumns = _.uniq(indexes.map(function(index) { return index.name }))
          expect(indexColumns).to.include('group_username_is_admin')

          self.queryInterface.removeIndex('Group', ['username', 'isAdmin']).complete(function(err) {
            expect(err).to.be.null

            self.queryInterface.showIndex('Group').complete(function(err, indexes) {
              expect(err).to.be.null

              indexColumns = _.uniq(indexes.map(function(index) { return index.name }))
              expect(indexColumns).to.be.empty

              done()
            })
          })
        })
      })
    })

    it('does not fail on reserved keywords', function () {
      return this.queryInterface.addIndex('Group', ['from']);
    });;
  });

  describe('describeTable', function() {
    it('reads the metadata of the table', function(done) {
      var self = this
      var Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true })

      Users.sync({ force: true }).success(function() {
        self.queryInterface.describeTable('_Users').complete(function(err, metadata) {
          expect(err).to.be.null

          var username = metadata.username
          var isAdmin  = metadata.isAdmin
          var enumVals = metadata.enumVals

          expect(username.type).to.equal(dialect === 'postgres' ? 'CHARACTER VARYING' : 'VARCHAR(255)')
          expect(username.allowNull).to.be.true
          expect(username.defaultValue).to.be.null

          expect(isAdmin.type).to.equal(dialect === 'postgres' ? 'BOOLEAN' : 'TINYINT(1)')
          expect(isAdmin.allowNull).to.be.true
          expect(isAdmin.defaultValue).to.be.null

          if (dialect === "postgres" || dialect === "postgres-native") {
            expect(enumVals.special).to.be.instanceof(Array)
            expect(enumVals.special).to.have.length(2);
          }

          done()
        })
      })
    })
  })

  describe('createTable', function () {
    it('should work with enums (1)', function () {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: DataTypes.ENUM('value1', 'value2', 'value3')
      })
    })

    it('should work with enums (2)', function () {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        }
      });
    });

    it('should work with schemas', function () {
      var self = this;
      return self.sequelize.dropAllSchemas().then(function () {
        return self.sequelize.createSchema("hero");
      }).then(function () {
        return self.queryInterface.createTable('User', {
          name: {
            type: DataTypes.STRING
          }
        }, {
          schema: 'hero'
        });
      }).then(function () {
        return self.queryInterface.rawSelect('User', {
          schema: 'hero'
        }, 'name');
      });
    });
  })

  describe('renameColumn', function() {
    it('rename a simple column', function() {
      var self = this
      var Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true })

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo')
      })
    })

    it('works with schemas', function () {
      var self = this
      var Users = self.sequelize.define('User', {
        username: DataTypes.STRING
      }, { 
        tableName: 'Users',
        schema: 'archive'
      })

      return self.sequelize.dropAllSchemas().then(function () {
        return self.sequelize.createSchema("archive");
      }).then(function () {
        return Users.sync({ force: true }).then(function() {
          return self.queryInterface.renameColumn({
            schema: 'archive',
            tableName: 'Users'
          }, 'username', 'pseudo');
        });
      });
    });

    it('rename a column non-null without default value', function() {
      var self = this
      var Users = self.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true })

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo')
      })
    })
    it('rename a boolean column non-null without default value', function() {
      var self = this
      var Users = self.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true })

      return Users.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('_Users', 'active', 'enabled')
      })
    })
    it('renames a column primary key autoincrement column', function() {
      var self = this
      var Fruits = self.sequelize.define('Fruit', {
        fruitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }, { freezeTableName: true })

      return Fruits.sync({ force: true }).then(function() {
        return self.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id')
      })
    })
  });

  describe('addColumn', function () {
    beforeEach(function () {
      return this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoincrement: true
        }
      });
    });

    it('should be able to add a foreign key reference', function () {
      return this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoincrement: true
        }
      }).bind(this).then(function () {
        return this.queryInterface.addColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: 'level',
          referenceKey: 'id',
          onUpdate: 'cascade',
          onDelete: 'set null'
        });
      });
    });

    it('should work with enums (1)', function () {
      return this.queryInterface.addColumn('users', 'someEnum', DataTypes.ENUM('value1', 'value2', 'value3'));
    });

    it('should work with enums (2)', function () {
      return this.queryInterface.addColumn('users', 'someOtherEnum', {
        type: DataTypes.ENUM,
        values: ['value1', 'value2', 'value3']
      });
    });
  });

  describe('describeForeignKeys', function() {
    beforeEach(function () {
      return this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoincrement: true
        },
      }).bind(this).then(function () {
        return this.queryInterface.createTable('hosts', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoincrement: true
          },
          admin: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id',
          },
          operator: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id',
            onUpdate: 'cascade',
          },
          owner: {
            type: DataTypes.INTEGER,
            references: 'users',
            referenceKey: 'id',
            onUpdate: 'cascade',
            onDelete: 'set null'
          },
        })
      })
    })

    it('should get a list of foreign keys for the table', function (done) {
      this.sequelize.query(this.queryInterface.QueryGenerator.getForeignKeysQuery('hosts', this.sequelize.config.database)).complete(function(err, fks) {
        expect(err).to.be.null
        expect(fks).to.have.length(3)
        var keys = Object.keys(fks[0]),
          keys2 = Object.keys(fks[1]),
          keys3 = Object.keys(fks[2])
        if (dialect === "postgres" || dialect === "postgres-native") {
          expect(keys).to.have.length(6)
          expect(keys2).to.have.length(7)
          expect(keys3).to.have.length(7)
        } else if (dialect === "sqlite") {
          expect(keys).to.have.length(8)
        } else if (dialect === "mysql") {
          expect(keys).to.have.length(1)
        } else {
          console.log("This test doesn't support " + dialect)
        }
        done()
      })

    })
  })

})
