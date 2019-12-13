'use strict';

const chai = require('chai'),
  Sequelize = require('../../../index'),
  Op = Sequelize.Op,
  Promise = Sequelize.Promise,
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  dialect = Support.getTestDialect(),
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
        no: { type: DataTypes.INTEGER, primaryKey: true },
        name: { type: DataTypes.STRING, allowNull: false }
      });
      this.Car = this.sequelize.define('Car', {
        plateNumber: {
          type: DataTypes.STRING,
          primaryKey: true,
          field: 'plate_number'
        },
        color: {
          type: DataTypes.TEXT
        }
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
      const values = new Array(10).fill({
        createdAt,
        updatedAt
      });

      return User.sync({ force: true }).then(() => {
        return User.bulkCreate(values, {
          silent: true
        }).then(() => {
          return User.findAll({
            where: {
              updatedAt: {
                [Op.ne]: null
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

      return User.sync({ force: true }).then(() => {
        return User.bulkCreate([
          { name: 'James' }
        ], { validate: true, individualHooks: true });
      });
    });

    it('should not map instance dataValues to fields with individualHooks: true', function() {
      const User = this.sequelize.define('user', {
        name: Sequelize.STRING,
        type: {
          type: Sequelize.STRING,
          allowNull: false,
          field: 'user_type'
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          field: 'created_at'
        },
        updatedAt: {
          type: Sequelize.DATE,
          field: 'modified_at'
        }
      });

      return User.sync({ force: true }).then(() => {
        return User.bulkCreate([
          { name: 'James', type: 'A' },
          { name: 'Alan', type: 'Z' }
        ], { individualHooks: true });
      });
    });

    it('should not insert NULL for unused fields', function() {
      const Beer = this.sequelize.define('Beer', {
        style: Sequelize.STRING,
        size: Sequelize.INTEGER
      });

      return Beer.sync({ force: true }).then(() => {
        return Beer.bulkCreate([{
          style: 'ipa'
        }], {
          logging(sql) {
            if (dialect === 'postgres') {
              expect(sql).to.include('INSERT INTO "Beers" ("id","style","createdAt","updatedAt") VALUES (DEFAULT');
            } else if (dialect === 'mssql') {
              expect(sql).to.include('INSERT INTO [Beers] ([style],[createdAt],[updatedAt]) ');
            } else { // mysql, sqlite
              expect(sql).to.include('INSERT INTO `Beers` (`id`,`style`,`createdAt`,`updatedAt`) VALUES (NULL');
            }
          }
        });
      });
    });

    it('properly handles disparate field lists', function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', uniqueName: '2' },
        { username: 'Steve', uniqueName: '3' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ where: { username: 'Paul' } }).then(users => {
          expect(users.length).to.equal(1);
          expect(users[0].username).to.equal('Paul');
          expect(users[0].secretValue).to.be.null;
        });
      });
    });

    it('inserts multiple values respecting the white list', function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      return this.User.bulkCreate(data, { fields: ['username', 'uniqueName'] }).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.be.null;
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.be.null;
        });
      });
    });

    it('should store all values if no whitelist is specified', function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].secretValue).to.equal('42');
          expect(users[1].username).to.equal('Paul');
          expect(users[1].secretValue).to.equal('23');
        });
      });
    });

    it('should set isNewRecord = false', function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
          expect(users.length).to.equal(2);
          users.forEach(user => {
            expect(user.isNewRecord).to.equal(false);
          });
        });
      });
    });

    it('saves data with single quote', function() {
      const quote = "Single'Quote",
        data = [{ username: 'Peter', data: quote, uniqueName: '1' },
          { username: 'Paul', data: quote, uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves data with double quote', function() {
      const quote = 'Double"Quote',
        data = [{ username: 'Peter', data: quote, uniqueName: '1' },
          { username: 'Paul', data: quote, uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
          expect(users.length).to.equal(2);
          expect(users[0].username).to.equal('Peter');
          expect(users[0].data).to.equal(quote);
          expect(users[1].username).to.equal('Paul');
          expect(users[1].data).to.equal(quote);
        });
      });
    });

    it('saves stringified JSON data', function() {
      const json = JSON.stringify({ key: 'value' }),
        data = [{ username: 'Peter', data: json, uniqueName: '1' },
          { username: 'Paul', data: json, uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
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

      return UserWithLength.sync({ force: true }).then(() => {
        return UserWithLength.bulkCreate([{ length: 42 }, { length: 11 }]);
      });
    });

    it('stores the current date in createdAt', function() {
      const data = [{ username: 'Peter', uniqueName: '1' },
        { username: 'Paul', uniqueName: '2' }];

      return this.User.bulkCreate(data).then(() => {
        return this.User.findAll({ order: ['id'] }).then(users => {
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
          { name: 'foo', code: '123' },
          { code: '1234' },
          { name: 'bar', code: '1' }
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
          { name: 'foo', code: '123' },
          { code: '1234' }
        ], { fields: ['code'], validate: true });
      });
    });

    it('should allow blank arrays (return immediately)', function() {
      const Worker = this.sequelize.define('Worker', {});
      return Worker.sync().then(() => {
        return Worker.bulkCreate([]).then(workers => {
          expect(workers).to.be.ok;
          expect(workers.length).to.equal(0);
        });
      });
    });

    it('should allow blank creates (with timestamps: false)', function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      return Worker.sync().then(() => {
        return Worker.bulkCreate([{}, {}]).then(workers => {
          expect(workers).to.be.ok;
        });
      });
    });

    it('should allow autoincremented attributes to be set', function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      return Worker.sync().then(() => {
        return Worker.bulkCreate([
          { id: 5 },
          { id: 10 }
        ]).then(() => {
          return Worker.findAll({ order: [['id', 'ASC']] }).then(workers => {
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

      return Support.dropTestSchemas(this.sequelize).then(() => {
        return this.sequelize.createSchema('space1');
      }).then(() => {
        return Dummy.sync({ force: true });
      }).then(() => {
        return Dummy.bulkCreate([
          { foo: 'a', bar: 'b' },
          { foo: 'c', bar: 'd' }
        ]);
      });
    });

    if (current.dialect.supports.inserts.ignoreDuplicates ||
        current.dialect.supports.inserts.onConflictDoNothing) {
      it('should support the ignoreDuplicates option', function() {
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(() => {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).then(() => {
            return this.User.findAll({ order: ['id'] }).then(users => {
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
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] }).then(() => {
          data.push({ uniqueName: 'Michael', secretValue: '26' });

          return this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true }).catch(err => {
            expect(err.message).to.equal(`${dialect} does not support the ignoreDuplicates option.`);
          });
        });
      });
    }

    if (current.dialect.supports.inserts.updateOnDuplicate) {
      describe('updateOnDuplicate', () => {
        it('should support the updateOnDuplicate option', function() {
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
            return this.User.bulkCreate(new_data, { fields: ['uniqueName', 'secretValue'], updateOnDuplicate: ['secretValue'] }).then(() => {
              return this.User.findAll({ order: ['id'] }).then(users => {
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

        describe('should support the updateOnDuplicate option with primary keys', () => {
          it('when the primary key column names and model field names are the same', function() {
            const data = [
              { no: 1, name: 'Peter' },
              { no: 2, name: 'Paul' }
            ];

            return this.Student.bulkCreate(data, { fields: ['no', 'name'], updateOnDuplicate: ['name'] }).then(() => {
              const new_data = [
                { no: 1, name: 'Peterson' },
                { no: 2, name: 'Paulson' },
                { no: 3, name: 'Michael' }
              ];
              return this.Student.bulkCreate(new_data, { fields: ['no', 'name'], updateOnDuplicate: ['name'] }).then(() => {
                return this.Student.findAll({ order: ['no'] }).then(students => {
                  expect(students.length).to.equal(3);
                  expect(students[0].name).to.equal('Peterson');
                  expect(students[0].no).to.equal(1);
                  expect(students[1].name).to.equal('Paulson');
                  expect(students[1].no).to.equal(2);
                  expect(students[2].name).to.equal('Michael');
                  expect(students[2].no).to.equal(3);
                });
              });
            });
          });

          it('when the primary key column names and model field names are different', function() {
            const data = [
              { plateNumber: 'abc', color: 'Grey' },
              { plateNumber: 'def', color: 'White' }
            ];

            return this.Car.bulkCreate(data, { fields: ['plateNumber', 'color'], updateOnDuplicate: ['color'] }).then(() => {
              const new_data = [
                { plateNumber: 'abc', color: 'Red' },
                { plateNumber: 'def', color: 'Green' },
                { plateNumber: 'ghi', color: 'Blue' }
              ];
              return this.Car.bulkCreate(new_data, { fields: ['plateNumber', 'color'], updateOnDuplicate: ['color'] }).then(() => {
                return this.Car.findAll({ order: ['plateNumber'] }).then(cars => {
                  expect(cars.length).to.equal(3);
                  expect(cars[0].plateNumber).to.equal('abc');
                  expect(cars[0].color).to.equal('Red');
                  expect(cars[1].plateNumber).to.equal('def');
                  expect(cars[1].color).to.equal('Green');
                  expect(cars[2].plateNumber).to.equal('ghi');
                  expect(cars[2].color).to.equal('Blue');
                });
              });
            });
          });

          it('when the primary key column names and model field names are different and have unique constraints', function() {
            const Person = this.sequelize.define('Person', {
              emailAddress: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
                unique: true,
                field: 'email_address'
              },
              name: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'name'
              }
            }, {});

            return Person.sync({ force: true })
              .then(() => {
                const inserts = [
                  { emailAddress: 'a@example.com', name: 'Alice' }
                ];
                return Person.bulkCreate(inserts);
              })
              .then(people => {
                expect(people.length).to.equal(1);
                expect(people[0].emailAddress).to.equal('a@example.com');
                expect(people[0].name).to.equal('Alice');

                const updates = [
                  { emailAddress: 'a@example.com', name: 'CHANGED NAME' },
                  { emailAddress: 'b@example.com', name: 'Bob' }
                ];

                return Person.bulkCreate(updates, { updateOnDuplicate: ['emailAddress', 'name'] });
              })
              .then(people => {
                expect(people.length).to.equal(2);
                expect(people[0].emailAddress).to.equal('a@example.com');
                expect(people[0].name).to.equal('CHANGED NAME');
                expect(people[1].emailAddress).to.equal('b@example.com');
                expect(people[1].name).to.equal('Bob');
              });
          });
        });


        it('should reject for non array updateOnDuplicate option', function() {
          const data = [
            { uniqueName: 'Peter', secretValue: '42' },
            { uniqueName: 'Paul', secretValue: '23' }
          ];

          return expect(
            this.User.bulkCreate(data, { updateOnDuplicate: true })
          ).to.be.rejectedWith('updateOnDuplicate option only supports non-empty array.');
        });

        it('should reject for empty array updateOnDuplicate option', function() {
          const data = [
            { uniqueName: 'Peter', secretValue: '42' },
            { uniqueName: 'Paul', secretValue: '23' }
          ];

          return expect(
            this.User.bulkCreate(data, { updateOnDuplicate: [] })
          ).to.be.rejectedWith('updateOnDuplicate option only supports non-empty array.');
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
            .then(([users, actualUsers]) => {
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
            .then(([users, actualUsers]) => {
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
        const Item = this.sequelize.define('Item', {
          state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
          name: Sequelize.STRING
        });

        return Item.sync({ force: true }).then(() => {
          return Item.bulkCreate([{ state: 'in_cart', name: 'A' }, { state: 'available', name: 'B' }]).then(() => {
            return Item.findOne({ where: { state: 'available' } }).then(item => {
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

      const M1 = { id: 1, name: 'Prathma Maya', secret: 'You are on list #1' };
      const M2 = { id: 2, name: 'Dwitiya Maya', secret: 'You are on list #2' };

      return Maya.sync({ force: true }).then(() => Maya.create(M1))
        .then(m => {
          expect(m.createdAt).to.be.ok;
          expect(m.id).to.be.eql(M1.id);
          expect(m.name).to.be.eql(M1.name);
          expect(m.secret).to.be.eql(M1.secret);

          return Maya.bulkCreate([M2]);
        }).then(([m]) => {

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
          .then(([users, actualUsers]) => {
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

    describe('virtual attribute', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('user', {
          password: {
            type: Sequelize.VIRTUAL,
            validate: {
              customValidator: () => {
                throw new Error('always invalid');
              }
            }
          }
        });
      });

      it('should validate', function() {
        return this.User
          .sync({ force: true })
          .then(() => this.User.bulkCreate([
            { password: 'password' }
          ], { validate: true }))
          .then(() => {
            expect.fail();
          }, error => {
            expect(error.length).to.equal(1);
            expect(error[0].message).to.match(/.*always invalid.*/);
          });
      });

      it('should not validate', function() {
        return this.User
          .sync({ force: true })
          .then(() => this.User.bulkCreate([
            { password: 'password' }
          ], { validate: false }))
          .then(users => {
            expect(users.length).to.equal(1);
          })
          .then(() => this.User.bulkCreate([
            { password: 'password' }
          ]))
          .then(users => {
            expect(users.length).to.equal(1);
          });
      });
    });
  });
});
