'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/support');
const DataTypes = require(__dirname + '/../../lib/data-types');
const dialect = Support.getTestDialect();
const Sequelize = Support.Sequelize;
const current = Support.sequelize;
const _ = require('lodash');

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return this.sequelize.dropAllSchemas();
  });

  describe('renameTable', () => {
    it('should rename table', function() {
      return this.queryInterface
        .createTable('myTestTable', {
          name: DataTypes.STRING
        })
        .then(() => this.queryInterface.renameTable('myTestTable', 'myTestTableNew'))
        .then(() => this.queryInterface.showAllTables())
        .then(tableNames => {
          if (dialect === 'mssql') {
            tableNames = _.map(tableNames, 'tableName');
          }
          expect(tableNames).to.contain('myTestTableNew');
          expect(tableNames).to.not.contain('myTestTable');
        });
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables', function() {
      const filterMSSQLDefault = tableNames => tableNames.filter(t => t.tableName !== 'spt_values');
      const self = this;
      return this.queryInterface.dropAllTables().then(() => {
        return self.queryInterface.showAllTables().then(tableNames => {
          // MSSQL include spt_values table which is system defined, hence cant be dropped
          tableNames = filterMSSQLDefault(tableNames);
          expect(tableNames).to.be.empty;
          return self.queryInterface.createTable('table', { name: DataTypes.STRING }).then(() => {
            return self.queryInterface.showAllTables().then(tableNames => {
              tableNames = filterMSSQLDefault(tableNames);
              expect(tableNames).to.have.length(1);
              return self.queryInterface.dropAllTables().then(() => {
                return self.queryInterface.showAllTables().then(tableNames => {
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
      const self = this;
      return self.queryInterface.createTable('skipme', {
        name: DataTypes.STRING
      }).then(() => {
        return self.queryInterface.dropAllTables({skip: ['skipme']}).then(() => {
          return self.queryInterface.showAllTables().then(tableNames => {
            if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
              tableNames = _.map(tableNames, 'tableName');
            }
            expect(tableNames).to.contain('skipme');
          });
        });
      });
    });
  });

  describe('indexes', () => {
    beforeEach(function() {
      const self = this;
      return this.queryInterface.dropTable('Group').then(() => {
        return self.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        });
      });
    });

    it('adds, reads and removes an index to the table', function() {
      const self = this;
      return this.queryInterface.addIndex('Group', ['username', 'isAdmin']).then(() => {
        return self.queryInterface.showIndex('Group').then(indexes => {
          let indexColumns = _.uniq(indexes.map(index => { return index.name; }));
          expect(indexColumns).to.include('group_username_is_admin');
          return self.queryInterface.removeIndex('Group', ['username', 'isAdmin']).then(() => {
            return self.queryInterface.showIndex('Group').then(indexes => {
              indexColumns = _.uniq(indexes.map(index => { return index.name; }));
              expect(indexColumns).to.be.empty;
            });
          });
        });
      });
    });

    it('works with schemas', function() {
      const self = this;
      return self.sequelize.createSchema('schema').then(() => {
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
      }).then(() => {
        return self.queryInterface.addIndex({
          schema: 'schema',
          tableName: 'table'
        }, ['name', 'isAdmin'], null, 'schema_table').then(() => {
          return self.queryInterface.showIndex({
            schema: 'schema',
            tableName: 'table'
          }).then(indexes => {
            expect(indexes.length).to.eq(1);
            const index = indexes[0];
            expect(index.name).to.eq('table_name_is_admin');
          });
        });
      });
    });

    it('does not fail on reserved keywords', function() {
      return this.queryInterface.addIndex('Group', ['from']);
    });
  });

  describe('describeTable', () => {
    it('reads the metadata of the table', function() {
      const self = this;
      const Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING,
        city: {
          type: DataTypes.STRING,
          defaultValue: null
        },
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return self.queryInterface.describeTable('_Users').then(metadata => {
          const id = metadata.id;
          const username = metadata.username;
          const city = metadata.city;
          const isAdmin = metadata.isAdmin;
          const enumVals = metadata.enumVals;

          expect(id.primaryKey).to.be.ok;

          let assertVal = 'VARCHAR(255)';
          switch (dialect) {
            case 'postgres':
              assertVal = 'CHARACTER VARYING(255)';
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

    it('should correctly determine the primary key columns', function() {
      const self = this;
      const Country = self.sequelize.define('_Country', {
        code: {type: DataTypes.STRING, primaryKey: true },
        name: {type: DataTypes.STRING, allowNull: false}
      }, { freezeTableName: true });
      const Alumni = self.sequelize.define('_Alumni', {
        year: {type: DataTypes.INTEGER, primaryKey: true },
        num: {type: DataTypes.INTEGER, primaryKey: true },
        username: {type: DataTypes.STRING, allowNull: false, unique: true },
        dob: {type: DataTypes.DATEONLY, allowNull: false },
        dod: {type: DataTypes.DATEONLY, allowNull: true },
        city: {type: DataTypes.STRING, allowNull: false},
        ctrycod: {type: DataTypes.STRING, allowNull: false,
          references: { model: Country, key: 'code'}}
      }, { freezeTableName: true });

      return Country.sync({ force: true }).then(() => {
        return self.queryInterface.describeTable('_Country').then(metacountry => {
          expect(metacountry.code.primaryKey).to.eql(true);
          expect(metacountry.name.primaryKey).to.eql(false);

          return Alumni.sync({ force: true }).then(() => {
            return self.queryInterface.describeTable('_Alumni').then(metalumni => {
              expect(metalumni.year.primaryKey).to.eql(true);
              expect(metalumni.num.primaryKey).to.eql(true);
              expect(metalumni.username.primaryKey).to.eql(false);
              expect(metalumni.dob.primaryKey).to.eql(false);
              expect(metalumni.dod.primaryKey).to.eql(false);
              expect(metalumni.ctrycod.primaryKey).to.eql(false);
              expect(metalumni.city.primaryKey).to.eql(false);
            });
          });
        });
      });
    });
  });

  // FIXME: These tests should make assertions against the created table using describeTable
  describe('createTable', () => {
    it('should create a auto increment primary key', function() {
      return this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).bind(this).then(function() {
        return this.queryInterface.insert(null, 'TableWithPK', {}, {raw: true, returning: true, plain: true}).then(results => {
          const response = _.head(results);
          expect(response.table_id || typeof response !== 'object' && response).to.be.ok;
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

    it('should work with enums (4)', function() {
      return this.queryInterface.createSchema('archive').bind(this).then(function() {
        return this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3'],
            field: 'otherName'
          }
        }, { schema: 'archive' });
      });
    });

    it('should work with schemas', function() {
      const self = this;
      return self.sequelize.createSchema('hero').then(() => {
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

  describe('renameColumn', () => {
    it('rename a simple column', function() {
      const self = this;
      const Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('works with schemas', function() {
      const self = this;
      return self.sequelize.createSchema('archive').then(() => {
        const Users = self.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          tableName: 'Users',
          schema: 'archive'
        });
        return Users.sync({ force: true }).then(() => {
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
      }).then(table => {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('rename a column non-null without default value', function() {
      const self = this;
      const Users = self.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return self.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('rename a boolean column non-null without default value', function() {
      const self = this;
      const Users = self.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return self.queryInterface.renameColumn('_Users', 'active', 'enabled');
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('enabled');
        expect(table).to.not.have.property('active');
      });
    });

    it('renames a column primary key autoIncrement column', function() {
      const self = this;
      const Fruits = self.sequelize.define('Fruit', {
        fruitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }, { freezeTableName: true });

      return Fruits.sync({ force: true }).then(() => {
        return self.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
      }).bind(this).then(function() {
        return this.queryInterface.describeTable('Fruit');
      }).then(table => {
        expect(table).to.have.property('fruit_id');
        expect(table).to.not.have.property('fruitId');
      });
    });

    it('shows a reasonable error message when column is missing', function() {
      const self = this;
      const Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      const outcome = Users.sync({ force: true }).then(() => {
        return self.queryInterface.renameColumn('_Users', 'email', 'pseudo');
      });

      return expect(outcome).to.be.rejectedWith('Table _Users doesn\'t have the column email');
    });
  });

  describe('addColumn', () => {
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
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'set null'
        });
      }).then(function() {
        return this.queryInterface.describeTable('users');
      }).then(table => {
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
        }).then(table => {
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

  describe('describeForeignKeys', () => {
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
              key: 'id'
            }
          },
          operator: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'cascade'
          },
          owner: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'set null'
          }
        });
      });
    });

    it('should get a list of foreign keys for the table', function() {
      const sql = this.queryInterface.QueryGenerator.getForeignKeysQuery('hosts', this.sequelize.config.database);
      const self = this;
      return this.sequelize.query(sql, {type: this.sequelize.QueryTypes.FOREIGNKEYS}).then(fks => {
        expect(fks).to.have.length(3);
        const keys = Object.keys(fks[0]),
          keys2 = Object.keys(fks[1]),
          keys3 = Object.keys(fks[2]);

        if (dialect === 'postgres' || dialect === 'postgres-native') {
          expect(keys).to.have.length(6);
          expect(keys2).to.have.length(7);
          expect(keys3).to.have.length(7);
        } else if (dialect === 'sqlite') {
          expect(keys).to.have.length(8);
        } else if (dialect === 'mysql' || dialect === 'mssql') {
          expect(keys).to.have.length(12);
        } else {
          console.log('This test doesn\'t support ' + dialect);
        }
        return fks;
      }).then(fks => {
        if (dialect === 'mysql') {
          return self.sequelize.query(
            self.queryInterface.QueryGenerator.getForeignKeyQuery('hosts', 'admin'),
            {}
          )
            .spread(fk => {
              expect(fks[0]).to.deep.eql(fk[0]);
            });
        }
        return;
      });
    });

    it('should get a list of foreign key references details for the table', function() {
      return this.queryInterface.getForeignKeyReferencesForTable('hosts', this.sequelize.options)
        .then(references => {
          expect(references).to.have.length(3);
          const keys = [];
          _.each(references, reference => {
            expect(reference.tableName).to.eql('hosts');
            expect(reference.referencedColumnName).to.eql('id');
            expect(reference.referencedTableName).to.eql('users');
            keys.push(reference.columnName);
          });
          expect(keys).to.have.same.members(['owner', 'operator', 'admin']);
        });
    });
  });

  describe('constraints', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('users', {
        username: DataTypes.STRING,
        email: DataTypes.STRING,
        roles: DataTypes.STRING
      });

      this.Post = this.sequelize.define('posts', {
        username: DataTypes.STRING
      });
      return this.sequelize.sync({ force: true });
    });


    describe('unique', () => {
      it('should add, read & remove unique constraint', function() {
        return this.queryInterface.addConstraint('users', ['email'], {
          type: 'unique'
        })
          .then(() => this.queryInterface.showConstraint('users'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            expect(constraints).to.include('users_email_uk');
            return this.queryInterface.removeConstraint('users', 'users_email_uk');
          })
          .then(() => this.queryInterface.showConstraint('users'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            expect(constraints).to.not.include('users_email_uk');
          });
      });
    });

    if (current.dialect.supports.constraints.check) {
      describe('check', () => {
        it('should add, read & remove check constraint', function() {
          return this.queryInterface.addConstraint('users', ['roles'], {
            type: 'check',
            where: {
              roles: ['user', 'admin', 'guest', 'moderator']
            },
            name: 'check_user_roles'
          })
            .then(() => this.queryInterface.showConstraint('users'))
            .then(constraints => {
              constraints = constraints.map(constraint => constraint.constraintName);
              expect(constraints).to.include('check_user_roles');
              return this.queryInterface.removeConstraint('users', 'check_user_roles');
            })
            .then(() => this.queryInterface.showConstraint('users'))
            .then(constraints => {
              constraints = constraints.map(constraint => constraint.constraintName);
              expect(constraints).to.not.include('check_user_roles');
            });
        });
      });
    }

    if (current.dialect.supports.constraints.default) {
      describe('default', () => {
        it('should add, read & remove default constraint', function() {
          return this.queryInterface.addConstraint('users', ['roles'], {
            type: 'default',
            defaultValue: 'guest'
          })
            .then(() => this.queryInterface.showConstraint('users'))
            .then(constraints => {
              constraints = constraints.map(constraint => constraint.constraintName);
              expect(constraints).to.include('users_roles_df');
              return this.queryInterface.removeConstraint('users', 'users_roles_df');
            })
            .then(() => this.queryInterface.showConstraint('users'))
            .then(constraints => {
              constraints = constraints.map(constraint => constraint.constraintName);
              expect(constraints).to.not.include('users_roles_df');
            });
        });
      });
    }


    describe('primary key', () => {
      it('should add, read & remove primary key constraint', function() {
        return this.queryInterface.removeColumn('users', 'id')
          .then(() => {
            return this.queryInterface.changeColumn('users', 'username', {
              type: DataTypes.STRING,
              allowNull: false
            });
          })
          .then(() => {
            return this.queryInterface.addConstraint('users', ['username'], {
              type: 'PRIMARY KEY'
            });
          })
          .then(() => this.queryInterface.showConstraint('users'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            //The name of primaryKey constraint is always PRIMARY in case of mysql
            if (dialect === 'mysql') {
              expect(constraints).to.include('PRIMARY');
              return this.queryInterface.removeConstraint('users', 'PRIMARY');
            } else {
              expect(constraints).to.include('users_username_pk');
              return this.queryInterface.removeConstraint('users', 'users_username_pk');
            }
          })
          .then(() => this.queryInterface.showConstraint('users'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            expect(constraints).to.not.include('users_username_pk');
          });
      });
    });

    describe('foreign key', () => {
      it('should add, read & remove foreign key constraint', function() {
        return this.queryInterface.removeColumn('users', 'id')
          .then(() => {
            return this.queryInterface.changeColumn('users', 'username', {
              type: DataTypes.STRING,
              allowNull: false
            });
          })
          .then(() => {
            return this.queryInterface.addConstraint('users', {
              type: 'PRIMARY KEY',
              fields: ['username']
            });
          })
          .then(() => {
            return this.queryInterface.addConstraint('posts', ['username'], {
              references: {
                table: 'users',
                field: 'username'
              },
              onDelete: 'cascade',
              onUpdate: 'cascade',
              type: 'foreign key'
            });
          })
          .then(() => this.queryInterface.showConstraint('posts'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            expect(constraints).to.include('posts_username_users_fk');
            return this.queryInterface.removeConstraint('posts', 'posts_username_users_fk');
          })
          .then(() => this.queryInterface.showConstraint('posts'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            expect(constraints).to.not.include('posts_username_users_fk');
          });
      });
    });

    describe('error handling', () => {
      it('should throw non existent constraints as UnknownConstraintError', function() {
        return expect(this.queryInterface.removeConstraint('users', 'unknown__contraint__name', {
          type: 'unique'
        })).to.eventually.be.rejectedWith(Sequelize.UnknownConstraintError);
      });
    });
  });
});
