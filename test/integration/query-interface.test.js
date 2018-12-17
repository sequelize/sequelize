'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const DataTypes = require('../../lib/data-types');
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
    return Support.dropTestSchemas(this.sequelize);
  });

  describe('dropAllSchema', () => {
    it('should drop all schema', function() {
      return this.queryInterface.dropAllSchemas(
        { skip: [this.sequelize.config.database] })
        .then(() => {
          return this.queryInterface.showAllSchemas();
        })
        .then(schemaNames => {

          return this.queryInterface.createSchema('newSchema')
            .then(() => {
              return this.queryInterface.showAllSchemas();
            })
            .then(newSchemaNames => {
              if (!current.dialect.supports.schemas) return;
              expect(newSchemaNames).to.have.length(schemaNames.length + 1);
              return this.queryInterface.dropSchema('newSchema');
            });
        });
    });
  });

  describe('renameTable', () => {
    it('should rename table', function() {
      return this.queryInterface
        .createTable('my_test_table', {
          name: DataTypes.STRING
        })
        .then(() => this.queryInterface.renameTable('my_test_table', 'my_test_table_new'))
        .then(() => this.queryInterface.showAllTables())
        .then(tableNames => {
          if (dialect === 'mssql' || dialect === 'mariadb') {
            tableNames = tableNames.map(v => v.tableName);
          }
          expect(tableNames).to.contain('my_test_table_new');
          expect(tableNames).to.not.contain('my_test_table');
        });
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables', function() {
      const filterMSSQLDefault = tableNames => tableNames.filter(t => t.tableName !== 'spt_values');
      return this.queryInterface.dropAllTables()
        .then(() => {
          return this.queryInterface.showAllTables();
        })
        .then(tableNames => {
          // MSSQL include spt_values table which is system defined, hence cant be dropped
          tableNames = filterMSSQLDefault(tableNames);
          expect(tableNames).to.be.empty;
          return this.queryInterface.createTable('table', { name: DataTypes.STRING });
        })
        .then(() => {
          return this.queryInterface.showAllTables();
        })
        .then(tableNames => {
          tableNames = filterMSSQLDefault(tableNames);
          expect(tableNames).to.have.length(1);
          return this.queryInterface.dropAllTables();
        })
        .then(() => {
          return this.queryInterface.showAllTables();
        })
        .then(tableNames => {
          // MSSQL include spt_values table which is system defined, hence cant be dropped
          tableNames = filterMSSQLDefault(tableNames);
          expect(tableNames).to.be.empty;
        });
    });

    it('should be able to skip given tables', function() {
      return this.queryInterface.createTable('skipme', {
        name: DataTypes.STRING
      })
        .then(() => this.queryInterface.dropAllTables({ skip: ['skipme'] }))
        .then(() => this.queryInterface.showAllTables())
        .then(tableNames => {
          if (dialect === 'mssql' || dialect === 'mariadb') {
            tableNames = tableNames.map(v => v.tableName);
          }
          expect(tableNames).to.contain('skipme');
        });
    });
  });

  describe('indexes', () => {
    beforeEach(function() {
      return this.queryInterface.dropTable('Group').then(() => {
        return this.queryInterface.createTable('Group', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN,
          from: DataTypes.STRING
        });
      });
    });

    it('adds, reads and removes an index to the table', function() {
      return this.queryInterface.addIndex('Group', ['username', 'isAdmin']).then(() => {
        return this.queryInterface.showIndex('Group').then(indexes => {
          let indexColumns = _.uniq(indexes.map(index => { return index.name; }));
          expect(indexColumns).to.include('group_username_is_admin');
          return this.queryInterface.removeIndex('Group', ['username', 'isAdmin']).then(() => {
            return this.queryInterface.showIndex('Group').then(indexes => {
              indexColumns = _.uniq(indexes.map(index => { return index.name; }));
              expect(indexColumns).to.be.empty;
            });
          });
        });
      });
    });

    it('works with schemas', function() {
      return this.sequelize.createSchema('schema').then(() => {
        return this.queryInterface.createTable('table', {
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
        return this.queryInterface.addIndex({
          schema: 'schema',
          tableName: 'table'
        }, ['name', 'isAdmin'], null, 'schema_table').then(() => {
          return this.queryInterface.showIndex({
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

  describe('renameColumn', () => {
    it('rename a simple column', function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      }).then(() => {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('works with schemas', function() {
      return this.sequelize.createSchema('archive').then(() => {
        const Users = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          tableName: 'Users',
          schema: 'archive'
        });
        return Users.sync({ force: true }).then(() => {
          return this.queryInterface.renameColumn({
            schema: 'archive',
            tableName: 'Users'
          }, 'username', 'pseudo');
        });
      }).then(() => {
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
      const Users = this.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      }).then(() => {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });
    });

    it('rename a boolean column non-null without default value', function() {
      const Users = this.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true });

      return Users.sync({ force: true }).then(() => {
        return this.queryInterface.renameColumn('_Users', 'active', 'enabled');
      }).then(() => {
        return this.queryInterface.describeTable('_Users');
      }).then(table => {
        expect(table).to.have.property('enabled');
        expect(table).to.not.have.property('active');
      });
    });

    it('renames a column primary key autoIncrement column', function() {
      const Fruits = this.sequelize.define('Fruit', {
        fruitId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }, { freezeTableName: true });

      return Fruits.sync({ force: true }).then(() => {
        return this.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
      }).then(() => {
        return this.queryInterface.describeTable('Fruit');
      }).then(table => {
        expect(table).to.have.property('fruit_id');
        expect(table).to.not.have.property('fruitId');
      });
    });

    it('shows a reasonable error message when column is missing', function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      const outcome = Users.sync({ force: true }).then(() => {
        return this.queryInterface.renameColumn('_Users', 'email', 'pseudo');
      });

      return expect(outcome).to.be.rejectedWith('Table _Users doesn\'t have the column email');
    });
  });

  describe('addColumn', () => {
    beforeEach(function() {
      return this.sequelize.createSchema('archive').then(() => {
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
      }).then(() => {
        return this.queryInterface.addColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            model: 'level',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'set null'
        });
      }).then(() => {
        return this.queryInterface.describeTable('users');
      }).then(table => {
        expect(table).to.have.property('level_id');
      });
    });

    it('addColumn expected error', function() {
      return this.queryInterface.createTable('level2', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).then(() => {
        expect(this.queryInterface.addColumn.bind(this, 'users', 'level_id')).to.throw(Error, 'addColumn takes at least 3 arguments (table, attribute name, attribute definition)');
        expect(this.queryInterface.addColumn.bind(this, null, 'level_id')).to.throw(Error, 'addColumn takes at least 3 arguments (table, attribute name, attribute definition)');
        expect(this.queryInterface.addColumn.bind(this, 'users', null, {})).to.throw(Error, 'addColumn takes at least 3 arguments (table, attribute name, attribute definition)');
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
      }).then(() => {
        return this.queryInterface.addColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'level_id', {
          type: DataTypes.INTEGER
        }).then(() => {
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
      }).then(() => {
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
      return this.sequelize.query(sql, { type: this.sequelize.QueryTypes.FOREIGNKEYS }).then(fks => {
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
          console.log(`This test doesn't support ${dialect}`);
        }
        return fks;
      }).then(fks => {
        if (dialect === 'mysql') {
          return this.sequelize.query(
            this.queryInterface.QueryGenerator.getForeignKeyQuery('hosts', 'admin'),
            {}
          )
            .then(([fk]) => {
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
          const keys = references.map(reference => {
            expect(reference.tableName).to.eql('hosts');
            expect(reference.referencedColumnName).to.eql('id');
            expect(reference.referencedTableName).to.eql('users');
            return reference.columnName;
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

        it('addconstraint missing type', function() {
          expect(this.queryInterface.addConstraint.bind(this, 'users', ['roles'], {
            where: { roles: ['user', 'admin', 'guest', 'moderator'] },
            name: 'check_user_roles'
          })).to.throw(Error, 'Constraint type must be specified through options.type');
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
            if (dialect === 'mysql' || dialect === 'mariadb') {
              expect(constraints).to.include('PRIMARY');
              return this.queryInterface.removeConstraint('users', 'PRIMARY');
            }
            expect(constraints).to.include('users_username_pk');
            return this.queryInterface.removeConstraint('users', 'users_username_pk');
          })
          .then(() => this.queryInterface.showConstraint('users'))
          .then(constraints => {
            constraints = constraints.map(constraint => constraint.constraintName);
            if (dialect === 'mysql' || dialect === 'mariadb') {
              expect(constraints).to.not.include('PRIMARY');
            } else {
              expect(constraints).to.not.include('users_username_pk');
            }
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

    describe('unknown constraint', () => {
      it('should throw non existent constraints as UnknownConstraintError', function() {
        const promise = this.queryInterface
          .removeConstraint('users', 'unknown__constraint__name', {
            type: 'unique'
          })
          .catch(e => {
            expect(e.table).to.equal('users');
            expect(e.constraint).to.equal('unknown__constraint__name');

            throw e;
          });

        return expect(promise).to.eventually.be.rejectedWith(Sequelize.UnknownConstraintError);
      });
    });
  });
});
