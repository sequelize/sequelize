'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  _ = require('lodash'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(function() {
    return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
      this.sequelize = sequelize;

      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        secretValue: {
          type: DataTypes.STRING,
          field: 'secret_value'
        },
        data: DataTypes.STRING,
        intVal: DataTypes.INTEGER,
        theDate: DataTypes.DATE,
        aBool: DataTypes.BOOLEAN,
        uniqueName: { type: DataTypes.STRING, unique: true }
      });
      this.Account = this.sequelize.define('Account', {
        accountName: DataTypes.STRING
      });
      this.Student = this.sequelize.define('Student', {
        no: {type: DataTypes.INTEGER, primaryKey: true},
        name: {type: DataTypes.STRING, allowNull: false}
      });

      return this.sequelize.sync({ force: true });
    });
  });

  describe('bulkCreate', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });
        let transaction, count1;
        return User.sync({ force: true })
          .then(() => this.sequelize.transaction())
          .then(t => {
            transaction = t;
            return User.bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction });
          })
          .then(() => User.count())
          .then(count => {
            count1 = count;
            return User.count({ transaction });
          })
          .then(count2 => {
            expect(count1).to.equal(0);
            expect(count2).to.equal(2);
            return transaction.rollback();
          });
      });
    }

    it('should be able to set createdAt and updatedAt if using silent: true', function() {
      const User = this.sequelize.define('user', {
        name: DataTypes.STRING
      }, {
        timestamps: true
      });

      const createdAt = new Date(2012, 10, 10, 10, 10, 10);
      const updatedAt = new Date(2011, 11, 11, 11, 11, 11);
      const values = _.map(new Array(10), () => {
        return {
          createdAt,
          updatedAt
        };
      });

      return User.sync({force: true}).then(() => {
        return User.bulkCreate(values, {
          silent: true
        }).then(() => {
          return User.findAll({
            where: {
              updatedAt: {
                ne: null
              }
            }
          }).then(users => {
            users.forEach(user => {
              expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
              expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());
            });
          });
        });
      });
    });

    it('should not fail on validate: true and individualHooks: true', function() {
      const User = this.sequelize.define('user', {
        name: Sequelize.STRING
      });

      return User.sync({force: true}).then(() => {
        return User.bulkCreate([
          {name: 'James'}
        ], {validate: true, individualHooks: true});
      });
    });

    it('should not insert NULL for unused fields', function() {
      const Beer = this.sequelize.define('Beer', {
        style: Sequelize.STRING,
        size: Sequelize.INTEGER
      });

      return Beer.sync({force: true}).then(() => {
        return Beer.bulkCreate([{
          style: 'ipa'
        }], {
          logging(sql) {
            if (dialect === 'postgres') {
              expect(sql.indexOf('INSERT INTO "Beers" ("id","style","createdAt","updatedAt") VALUES (DEFAULT')).not.be.equal(-1);
            } else if (dialect === 'mssql') {
              expect(sql.indexOf('INSERT INTO [Beers] ([style],[createdAt],[updatedAt]) VALUES')).not.be.equal(-1);
            } else { // mysql, sqlite
              expect(sql.indexOf('INSERT INTO `Beers` (`id`,`style`,`createdAt`,`updatedAt`) VALUES (NULL')).not.be.equal(-1);
            }
          }
        });
      });
    });

    it('properly handles disparate field lists', function() {
      const self = this,
        data = [{username: 'Peter', secretValue: '42', uniqueName: '1' },
          {username: 'Paul', uniqueName: '2'},
          {username: 'Steve', uniqueName: '3'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({where: {username: 'Paul'}}).then(users => {
          expect(users.length).to.equal(1);
          expect(users[0].username).to.equal('Paul');
          expect(users[0].secretValue).to.be.null;
        });
      });
    });

    it('inserts multiple values respecting the white list', function() {
      const self = this,
        data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
          { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      return this.User.bulkCreate(data, { fields: ['username', 'uniqueName'] }).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.be.null;
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.be.null;
        });
      });
    });

    it('should store all values if no whitelist is specified', function() {
      const self = this,
        data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
          { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.equal('42');
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.equal('23');
        });
      });
    });

    it('should set isNewRecord = false', function() {
      const self = this,
        data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
          { username: 'Paul', secretValue: '23', uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          users.forEach(user => {
            expect(user.isNewRecord).to.equal(false);
          });
        });
      });
    });

    it('saves data with single quote', function() {
      const self = this,
        quote = "Single'Quote",
        data = [{ username: 'Peter', data: quote, uniqueName: '1'},
          { username: 'Paul', data: quote, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves data with double quote', function() {
      const self = this,
        quote = 'Double"Quote',
        data = [{ username: 'Peter', data: quote, uniqueName: '1'},
          { username: 'Paul', data: quote, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves stringified JSON data', function() {
      const self = this,
        json = JSON.stringify({ key: 'value' }),
        data = [{ username: 'Peter', data: json, uniqueName: '1'},
          { username: 'Paul', data: json, uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(json);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(json);
        });
      });
    });

    it('properly handles a model with a length column', function() {
      const UserWithLength = this.sequelize.define('UserWithLength', {
        length: Sequelize.INTEGER
      });

      return UserWithLength.sync({force: true}).then(() => {
        return UserWithLength.bulkCreate([{ length: 42}, {length: 11}]);
      });
    });

    it('stores the current date in createdAt', function() {
      const self = this,
        data = [{ username: 'Peter', uniqueName: '1'},
          { username: 'Paul', uniqueName: '2'}];

      return this.User.bulkCreate(data).then(() => {
        return self.User.findAll({order: ['id']}).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(parseInt(+users[0].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
          expect(users[1].username).to.equal('Paul');
          expect(parseInt(+users[1].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
        });
      });
    });

    it('emits an error when validate is set to true', function() {
      const Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          allowNull: false
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      });

      return Tasks.sync({ force: true }).then(() => {
        return Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'},
          {name: 'bar', code: '1'}
        ], { validate: true }).catch(errors => {
          const expectedValidationError = 'Validation len on code failed';
          const expectedNotNullError = 'notNull Violation: Task.name cannot be null';

          expect(errors).to.be.instanceof(Promise.AggregateError);
          expect(errors.toString()).to.include(expectedValidationError)
            .and.to.include(expectedNotNullError);
          expect(errors).to.have.length(2);

          const e0name0 = errors[0].errors.get('name')[0];

          expect(errors[0].record.code).to.equal('1234');
          expect(e0name0.type || e0name0.origin).to.equal('notNull Violation');

          expect(errors[1].record.name).to.equal('bar');
          expect(errors[1].record.code).to.equal('1');
          expect(errors[1].errors.get('code')[0].message).to.equal(expectedValidationError);
        });
      });
    });

    it("doesn't emit an error when validate is set to true but our selectedValues are fine", function() {
      const Tasks = this.sequelize.define('Task', {
        name: {
          type: Sequelize.STRING,
          validate: {
            notEmpty: true
          }
        },
        code: {
          type: Sequelize.STRING,
          validate: {
            len: [3, 10]
          }
        }
      });

      return Tasks.sync({ force: true }).then(() => {
        return Tasks.bulkCreate([
          {name: 'foo', code: '123'},
          {code: '1234'}
        ], { fields: ['code'], validate: true });
      });
    });

    it('should allow blank arrays (return immediatly)', function() {
      const Worker = this.sequelize.define('Worker', {});
      return Worker.sync().then(() => {
        return Worker.bulkCreate([]).then(workers => {
          expect(workers).to.be.ok;
          expect(workers.length).to.equal(0);
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function() {
      const Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(() => {
        return Worker.bulkCreate([{}, {}]).then(workers => {
          expect(workers).to.be.ok;
        });
      });
    });

    it('should allow autoincremented attributes to be set', function() {
      const Worker = this.sequelize.define('Worker', {}, {timestamps: false});
      return Worker.sync().then(() => {
        return Worker.bulkCreate([
          {id: 5},
          {id: 10}
        ]).then(() => {
          return Worker.findAll({order: [['id', 'ASC']]}).then(workers => {
            expect(workers[0].id).to.equal(5);
            expect(workers[1].id).to.equal(10);
          });
        });
      });
    });

    it('should support schemas', function() {
      const Dummy = this.sequelize.define('Dummy', {
        foo: DataTypes.STRING,
        bar: DataTypes.STRING
      }, {
        schema: 'space1',
        tableName: 'Dummy'
      });

      return this.sequelize.dropAllSchemas().bind(this).then(function() {
        return this.sequelize.createSchema('space1');
      }).then(() => {
        return Dummy.sync({force: true});
      }).then(() => {
        return Dummy.bulkCreate([
          {foo: 'a', bar: 'b'},
          {foo: 'c', bar: 'd'}
        ]);
      });
    });

    if (current.dialect.supports.ignoreDuplicates ||
        current.dialect.supports.onConflictDoNothing) {
      it('should support the ignoreDuplicates option', function() {
        const self = this;
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(() => {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          return self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).then(() => {
            return self.User.findAll({order: ['id']}).then(users => {
              expect(users.length).to.equal(3);
              expect(users[0].uniqueName).to.equal('Peter');
              expect(users[0].secretValue).to.equal('42');
              expect(users[1].uniqueName).to.equal('Paul');
              expect(users[1].secretValue).to.equal('23');
              expect(users[2].uniqueName).to.equal('Michael');
              expect(users[2].secretValue).to.equal('26');
            });
          });
        });
      });
    } else {
      it('should throw an error when the ignoreDuplicates option is passed', function() {
        const self = this;
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(() => {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          return self.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).catch(err => {
            if (dialect === 'mssql') {
              expect(err.message).to.match(/mssql does not support the \'ignoreDuplicates\' option./);
            } else {
              expect(err.message).to.match(/postgres does not support the \'ignoreDuplicates\' option./);
            }
          });
        });
      });
    }

    if (current.dialect.supports.updateOnDuplicate) {
      it('should support the updateOnDuplicate option', function() {
        const self = this;
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], updateOnDuplicate: ['secretValue'] }).then(() => {
          const new_data = [
            { uniqueName: 'Peter', secretValue: '43' },
            { uniqueName: 'Paul', secretValue: '24' },
            { uniqueName: 'Michael', secretValue: '26' }
          ];
          return self.User.bulkCreate(new_data, { fields: ['uniqueName', 'secretValue'], updateOnDuplicate: ['secretValue'] }).then(() => {
            return self.User.findAll({order: ['id']}).then(users => {
              expect(users.length).to.equal(3);
              expect(users[0].uniqueName).to.equal('Peter');
              expect(users[0].secretValue).to.equal('43');
              expect(users[1].uniqueName).to.equal('Paul');
              expect(users[1].secretValue).to.equal('24');
              expect(users[2].uniqueName).to.equal('Michael');
              expect(users[2].secretValue).to.equal('26');
            });
          });
        });
      });
    }

    if (current.dialect.supports.returnValues) {
      describe('return values', () => {
        it('should make the auto incremented values available on the returned instances', function() {
          const User = this.sequelize.define('user', {});

          return User
            .sync({ force: true })
            .then(() => User.bulkCreate([
              {},
              {},
              {}
            ], {
              returning: true
            }))
            .then(users =>
              User.findAll({ order: ['id'] })
                .then(actualUsers => [users, actualUsers])
            )
            .spread((users, actualUsers) => {
              expect(users.length).to.eql(actualUsers.length);
              users.forEach((user, i) => {
                expect(user.get('id')).to.be.ok;
                expect(user.get('id')).to.equal(actualUsers[i].get('id'))
                  .and.to.equal(i + 1);
              });
            });
        });

        it('should make the auto incremented values available on the returned instances with custom fields', function() {
          const User = this.sequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id'
            }
          });

          return User
            .sync({ force: true })
            .then(() => User.bulkCreate([
              {},
              {},
              {}
            ], {
              returning: true
            }))
            .then(users =>
              User.findAll({ order: ['maId'] })
                .then(actualUsers => [users, actualUsers])
            )
            .spread((users, actualUsers) => {
              expect(users.length).to.eql(actualUsers.length);
              users.forEach((user, i) => {
                expect(user.get('maId')).to.be.ok;
                expect(user.get('maId')).to.equal(actualUsers[i].get('maId'))
                  .and.to.equal(i + 1);
              });
            });
        });
      });
    }

    describe('enums', () => {
      it('correctly restores enum values', function() {
        const self = this,
          Item = self.sequelize.define('Item', {
            state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
            name: Sequelize.STRING
          });

        return Item.sync({ force: true }).then(() => {
          return Item.bulkCreate([{state: 'in_cart', name: 'A'}, { state: 'available', name: 'B'}]).then(() => {
            return Item.find({ where: { state: 'available' }}).then(item => {
              expect(item.name).to.equal('B');
            });
          });
        });
      });
    });

    it('should properly map field names to attribute names', function() {
      const Maya = this.sequelize.define('Maya', {
        name: Sequelize.STRING,
        secret: {
          field: 'secret_given',
          type: Sequelize.STRING
        },
        createdAt: {
          field: 'created_at',
          type: Sequelize.DATE
        },
        updatedAt: {
          field: 'updated_at',
          type: Sequelize.DATE
        }
      });

      const M1 = { id: 1, name: 'Prathma Maya', secret: 'You are on list #1'};
      const M2 = { id: 2, name: 'Dwitiya Maya', secret: 'You are on list #2'};

      return Maya.sync({ force: true }).then(() => Maya.create(M1))
        .then(m => {
          expect(m.createdAt).to.be.ok;
          expect(m.id).to.be.eql(M1.id);
          expect(m.name).to.be.eql(M1.name);
          expect(m.secret).to.be.eql(M1.secret);

          return Maya.bulkCreate([M2]);
        }).spread(m => {

          // only attributes are returned, no fields are mixed
          expect(m.createdAt).to.be.ok;
          expect(m.created_at).to.not.exist;
          expect(m.secret_given).to.not.exist;
          expect(m.get('secret_given')).to.be.undefined;
          expect(m.get('created_at')).to.be.undefined;

          // values look fine
          expect(m.id).to.be.eql(M2.id);
          expect(m.name).to.be.eql(M2.name);
          expect(m.secret).to.be.eql(M2.secret);
        });
    });

    describe('handles auto increment values', () => {
      it('should return auto increment primary key values', function() {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        return Maya.sync({ force: true })
          .then(() => Maya.bulkCreate([M1, M2], { returning: true }))
          .then(ms => {
            expect(ms[0].id).to.be.eql(1);
            expect(ms[1].id).to.be.eql(2);
          });
      });

      it('should return supplied values on primary keys', function() {
        const User = this.sequelize.define('user', {});

        return User
          .sync({ force: true })
          .then(() => User.bulkCreate([
            { id: 1 },
            { id: 2 },
            { id: 3 }
          ], { returning: true }))
          .then(users =>
            User.findAll({ order: [['id', 'ASC']] })
              .then(actualUsers => [users, actualUsers])
          )
          .spread((users, actualUsers) => {
            expect(users.length).to.eql(actualUsers.length);

            expect(users[0].get('id')).to.equal(1).and.to.equal(actualUsers[0].get('id'));
            expect(users[1].get('id')).to.equal(2).and.to.equal(actualUsers[1].get('id'));
            expect(users[2].get('id')).to.equal(3).and.to.equal(actualUsers[2].get('id'));
          });
      });

      it('should return supplied values on primary keys when some instances already exists', function() {
        const User = this.sequelize.define('user', {});

        return User
          .sync({ force: true })
          .then(() => User.bulkCreate([
            { id: 1 },
            { id: 3 }
          ]))
          .then(() => User.bulkCreate([
            { id: 2 },
            { id: 4 },
            { id: 5 }
          ], { returning: true }))
          .then(users => {
            expect(users.length).to.eql(3);

            expect(users[0].get('id')).to.equal(2);
            expect(users[1].get('id')).to.equal(4);
            expect(users[2].get('id')).to.equal(5);
          });
      });
    });
  });
});
