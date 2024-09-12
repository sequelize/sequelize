'use strict';

const chai = require('chai'),
  Sequelize = require('sequelize'),
  AggregateError = require('sequelize/lib/errors/aggregate-error'),
  Op = Sequelize.Op,
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(async function() {
    const sequelize = await Support.prepareTransactionTest(this.sequelize);
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

    await this.sequelize.sync({ force: true });
  });

  describe('bulkCreate', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });
        await User.sync({ force: true });
        const transaction = await this.sequelize.transaction();
        await User.bulkCreate([{ username: 'foo' }, { username: 'bar' }], { transaction });
        const count1 = await User.count();
        const count2 = await User.count({ transaction });
        expect(count1).to.equal(0);
        expect(count2).to.equal(2);
        await transaction.rollback();
      });
    }

    it('should not alter options', async function() {
      const User = this.sequelize.define('User');
      await User.sync({ force: true });
      const options = { anOption: 1 };
      await User.bulkCreate([{  }], options);
      expect(options).to.eql({ anOption: 1 });
    });

    it('should be able to set createdAt and updatedAt if using silent: true', async function() {
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

      await User.sync({ force: true });

      await User.bulkCreate(values, {
        silent: true
      });

      const users = await User.findAll({
        where: {
          updatedAt: {
            [Op.ne]: null
          }
        }
      });

      users.forEach(user => {
        expect(createdAt.getTime()).to.equal(user.get('createdAt').getTime());
        expect(updatedAt.getTime()).to.equal(user.get('updatedAt').getTime());
      });
    });

    it('should not fail on validate: true and individualHooks: true', async function() {
      const User = this.sequelize.define('user', {
        name: Sequelize.STRING
      });

      await User.sync({ force: true });

      await User.bulkCreate([
        { name: 'James' }
      ], { validate: true, individualHooks: true });
    });

    it('should not map instance dataValues to fields with individualHooks: true', async function() {
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

      await User.sync({ force: true });

      await User.bulkCreate([
        { name: 'James', type: 'A' },
        { name: 'Alan', type: 'Z' }
      ], { individualHooks: true });
    });

    it('should not insert NULL for unused fields', async function() {
      const Beer = this.sequelize.define('Beer', {
        style: Sequelize.STRING,
        size: Sequelize.INTEGER
      });

      await Beer.sync({ force: true });

      await Beer.bulkCreate([{
        style: 'ipa'
      }], {
        logging(sql) {
          if (['postgres', 'oracle'].includes(dialect)) {
            expect(sql).to.include('INSERT INTO "Beers" ("id","style","createdAt","updatedAt") VALUES (DEFAULT');
          } else if (dialect === 'db2') {
            expect(sql).to.include('INSERT INTO "Beers" ("style","createdAt","updatedAt") VALUES');
          } else if (dialect === 'mssql') {
            expect(sql).to.include('INSERT INTO [Beers] ([style],[createdAt],[updatedAt]) ');
          } else { // mysql, sqlite
            expect(sql).to.include('INSERT INTO `Beers` (`id`,`style`,`createdAt`,`updatedAt`) VALUES (NULL');
          }
        }
      });
    });

    it('properly handles disparate field lists', async function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', uniqueName: '2' },
        { username: 'Steve', uniqueName: '3' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ where: { username: 'Paul' } });
      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal('Paul');
      expect(users[0].secretValue).to.be.null;
    });

    it('inserts multiple values respecting the white list', async function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      await this.User.bulkCreate(data, { fields: ['username', 'uniqueName'] });
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(users[0].secretValue).to.be.null;
      expect(users[1].username).to.equal('Paul');
      expect(users[1].secretValue).to.be.null;
    });

    it('should store all values if no whitelist is specified', async function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(users[0].secretValue).to.equal('42');
      expect(users[1].username).to.equal('Paul');
      expect(users[1].secretValue).to.equal('23');
    });

    it('should set isNewRecord = false', async function() {
      const data = [{ username: 'Peter', secretValue: '42', uniqueName: '1' },
        { username: 'Paul', secretValue: '23', uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      users.forEach(user => {
        expect(user.isNewRecord).to.equal(false);
      });
    });

    it('saves data with single quote', async function() {
      const quote = "Single'Quote",
        data = [{ username: 'Peter', data: quote, uniqueName: '1' },
          { username: 'Paul', data: quote, uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(users[0].data).to.equal(quote);
      expect(users[1].username).to.equal('Paul');
      expect(users[1].data).to.equal(quote);
    });

    it('saves data with double quote', async function() {
      const quote = 'Double"Quote',
        data = [{ username: 'Peter', data: quote, uniqueName: '1' },
          { username: 'Paul', data: quote, uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(users[0].data).to.equal(quote);
      expect(users[1].username).to.equal('Paul');
      expect(users[1].data).to.equal(quote);
    });

    it('saves stringified JSON data', async function() {
      const json = JSON.stringify({ key: 'value' }),
        data = [{ username: 'Peter', data: json, uniqueName: '1' },
          { username: 'Paul', data: json, uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(users[0].data).to.equal(json);
      expect(users[1].username).to.equal('Paul');
      expect(users[1].data).to.equal(json);
    });

    it('properly handles a model with a length column', async function() {
      const UserWithLength = this.sequelize.define('UserWithLength', {
        length: Sequelize.INTEGER
      });

      await UserWithLength.sync({ force: true });

      await UserWithLength.bulkCreate([{ length: 42 }, { length: 11 }]);
    });

    it('stores the current date in createdAt', async function() {
      const data = [{ username: 'Peter', uniqueName: '1' },
        { username: 'Paul', uniqueName: '2' }];

      await this.User.bulkCreate(data);
      const users = await this.User.findAll({ order: ['id'] });
      expect(users.length).to.equal(2);
      expect(users[0].username).to.equal('Peter');
      expect(parseInt(+users[0].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
      expect(users[1].username).to.equal('Paul');
      expect(parseInt(+users[1].createdAt / 5000, 10)).to.be.closeTo(parseInt(+new Date() / 5000, 10), 1.5);
    });

    it('emits an error when validate is set to true', async function() {
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

      await Tasks.sync({ force: true });

      try {
        await Tasks.bulkCreate([
          { name: 'foo', code: '123' },
          { code: '1234' },
          { name: 'bar', code: '1' }
        ], { validate: true });
      } catch (error) {
        const expectedValidationError = 'Validation len on code failed';
        const expectedNotNullError = 'notNull Violation: Task.name cannot be null';

        expect(error.toString()).to.include(expectedValidationError)
          .and.to.include(expectedNotNullError);
        const { errors } = error;
        expect(errors).to.have.length(2);

        const e0name0 = errors[0].errors.get('name')[0];

        expect(errors[0].record.code).to.equal('1234');
        expect(e0name0.type || e0name0.origin).to.equal('notNull Violation');

        expect(errors[1].record.name).to.equal('bar');
        expect(errors[1].record.code).to.equal('1');
        expect(errors[1].errors.get('code')[0].message).to.equal(expectedValidationError);
      }
    });

    it("doesn't emit an error when validate is set to true but our selectedValues are fine", async function() {
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

      await Tasks.sync({ force: true });

      await Tasks.bulkCreate([
        { name: 'foo', code: '123' },
        { code: '1234' }
      ], { fields: ['code'], validate: true });
    });

    it('should allow blank arrays (return immediately)', async function() {
      const Worker = this.sequelize.define('Worker', {});
      await Worker.sync();
      const workers = await Worker.bulkCreate([]);
      expect(workers).to.be.ok;
      expect(workers.length).to.equal(0);
    });

    it('should allow blank creates (with timestamps: false)', async function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();
      const workers = await Worker.bulkCreate([{}, {}]);
      expect(workers).to.be.ok;
    });

    it('should allow autoincremented attributes to be set', async function() {
      const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
      await Worker.sync();

      await Worker.bulkCreate([
        { id: 5 },
        { id: 10 }
      ]);

      const workers = await Worker.findAll({ order: [['id', 'ASC']] });
      expect(workers[0].id).to.equal(5);
      expect(workers[1].id).to.equal(10);
    });

    it('should support schemas', async function() {
      const Dummy = this.sequelize.define('Dummy', {
        foo: DataTypes.STRING,
        bar: DataTypes.STRING
      }, {
        schema: 'space1',
        tableName: 'Dummy'
      });

      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.createSchema('space1');
      await Dummy.sync({ force: true });

      await Dummy.bulkCreate([
        { foo: 'a', bar: 'b' },
        { foo: 'c', bar: 'd' }
      ]);
    });

    if (current.dialect.supports.inserts.ignoreDuplicates ||
        current.dialect.supports.inserts.onConflictDoNothing) {
      it('should support the ignoreDuplicates option', async function() {
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        await this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] });
        data.push({ uniqueName: 'Michael', secretValue: '26' });

        await this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true });
        const users = await this.User.findAll({ order: ['id'] });
        expect(users.length).to.equal(3);
        expect(users[0].uniqueName).to.equal('Peter');
        expect(users[0].secretValue).to.equal('42');
        expect(users[1].uniqueName).to.equal('Paul');
        expect(users[1].secretValue).to.equal('23');
        expect(users[2].uniqueName).to.equal('Michael');
        expect(users[2].secretValue).to.equal('26');
      });
    } else {
      it('should throw an error when the ignoreDuplicates option is passed', async function() {
        const data = [
          { uniqueName: 'Peter', secretValue: '42' },
          { uniqueName: 'Paul', secretValue: '23' }
        ];

        await this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'] });
        data.push({ uniqueName: 'Michael', secretValue: '26' });

        try {
          await this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], ignoreDuplicates: true });
        } catch (err) {
          expect(err.message).to.equal(`${dialect} does not support the ignoreDuplicates option.`);
        }
      });
    }

    if (current.dialect.supports.inserts.updateOnDuplicate) {
      describe('updateOnDuplicate', () => {
        it('should support the updateOnDuplicate option', async function() {
          const data = [
            { uniqueName: 'Peter', secretValue: '42' },
            { uniqueName: 'Paul', secretValue: '23' }
          ];

          await this.User.bulkCreate(data, { fields: ['uniqueName', 'secretValue'], updateOnDuplicate: ['secretValue'] });
          const new_data = [
            { uniqueName: 'Peter', secretValue: '43' },
            { uniqueName: 'Paul', secretValue: '24' },
            { uniqueName: 'Michael', secretValue: '26' }
          ];
          await this.User.bulkCreate(new_data, { fields: ['uniqueName', 'secretValue'], updateOnDuplicate: ['secretValue'] });
          const users = await this.User.findAll({ order: ['id'] });
          expect(users.length).to.equal(3);
          expect(users[0].uniqueName).to.equal('Peter');
          expect(users[0].secretValue).to.equal('43');
          expect(users[1].uniqueName).to.equal('Paul');
          expect(users[1].secretValue).to.equal('24');
          expect(users[2].uniqueName).to.equal('Michael');
          expect(users[2].secretValue).to.equal('26');
        });

        describe('should support the updateOnDuplicate option with primary keys', () => {
          it('when the primary key column names and model field names are the same', async function() {
            const data = [
              { no: 1, name: 'Peter' },
              { no: 2, name: 'Paul' }
            ];

            await this.Student.bulkCreate(data, { fields: ['no', 'name'], updateOnDuplicate: ['name'] });
            const new_data = [
              { no: 1, name: 'Peterson' },
              { no: 2, name: 'Paulson' },
              { no: 3, name: 'Michael' }
            ];
            await this.Student.bulkCreate(new_data, { fields: ['no', 'name'], updateOnDuplicate: ['name'] });
            const students = await this.Student.findAll({ order: ['no'] });
            expect(students.length).to.equal(3);
            expect(students[0].name).to.equal('Peterson');
            expect(students[0].no).to.equal(1);
            expect(students[1].name).to.equal('Paulson');
            expect(students[1].no).to.equal(2);
            expect(students[2].name).to.equal('Michael');
            expect(students[2].no).to.equal(3);
          });

          it('when the primary key column names and model field names are different', async function() {
            const data = [
              { plateNumber: 'abc', color: 'Grey' },
              { plateNumber: 'def', color: 'White' }
            ];

            await this.Car.bulkCreate(data, { fields: ['plateNumber', 'color'], updateOnDuplicate: ['color'] });
            const new_data = [
              { plateNumber: 'abc', color: 'Red' },
              { plateNumber: 'def', color: 'Green' },
              { plateNumber: 'ghi', color: 'Blue' }
            ];
            await this.Car.bulkCreate(new_data, { fields: ['plateNumber', 'color'], updateOnDuplicate: ['color'] });
            const cars = await this.Car.findAll({ order: ['plateNumber'] });
            expect(cars.length).to.equal(3);
            expect(cars[0].plateNumber).to.equal('abc');
            expect(cars[0].color).to.equal('Red');
            expect(cars[1].plateNumber).to.equal('def');
            expect(cars[1].color).to.equal('Green');
            expect(cars[2].plateNumber).to.equal('ghi');
            expect(cars[2].color).to.equal('Blue');
          });

          it('when the primary key column names and model field names are different and have unique constraints', async function() {
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

            await Person.sync({ force: true });
            const inserts = [
              { emailAddress: 'a@example.com', name: 'Alice' }
            ];
            const people0 = await Person.bulkCreate(inserts);
            expect(people0.length).to.equal(1);
            expect(people0[0].emailAddress).to.equal('a@example.com');
            expect(people0[0].name).to.equal('Alice');

            const updates = [
              { emailAddress: 'a@example.com', name: 'CHANGED NAME' },
              { emailAddress: 'b@example.com', name: 'Bob' }
            ];

            const people = await Person.bulkCreate(updates, { updateOnDuplicate: ['emailAddress', 'name'] });
            expect(people.length).to.equal(2);
            expect(people[0].emailAddress).to.equal('a@example.com');
            expect(people[0].name).to.equal('CHANGED NAME');
            expect(people[1].emailAddress).to.equal('b@example.com');
            expect(people[1].name).to.equal('Bob');
          });

          it('when the composite primary key column names and model field names are different', async function() {
            const Person = this.sequelize.define('Person', {
              systemId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                field: 'system_id'
              },
              system: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
                field: 'system'
              },
              name: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'name'
              }
            }, {});

            await Person.sync({ force: true });
            const inserts = [
              { systemId: 1, system: 'system1', name: 'Alice' }
            ];
            const people0 = await Person.bulkCreate(inserts);
            expect(people0.length).to.equal(1);
            expect(people0[0].systemId).to.equal(1);
            expect(people0[0].system).to.equal('system1');
            expect(people0[0].name).to.equal('Alice');

            const updates = [
              { systemId: 1, system: 'system1', name: 'CHANGED NAME' },
              { systemId: 1, system: 'system2', name: 'Bob' }
            ];

            const people = await Person.bulkCreate(updates, { updateOnDuplicate: ['systemId', 'system', 'name'] });
            expect(people.length).to.equal(2);
            expect(people[0].systemId).to.equal(1);
            expect(people[0].system).to.equal('system1');
            expect(people[0].name).to.equal('CHANGED NAME');
            expect(people[1].systemId).to.equal(1);
            expect(people[1].system).to.equal('system2');
            expect(people[1].name).to.equal('Bob');
          });

          it('when the primary key column names and model field names are different and have composite unique constraints', async function() {
            const Person = this.sequelize.define('Person', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                field: 'id'
              },
              systemId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: 'system_id_system_unique',
                field: 'system_id'
              },
              system: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: 'system_id_system_unique',
                field: 'system'
              },
              name: {
                type: DataTypes.STRING,
                allowNull: false,
                field: 'name'
              }
            }, {});

            await Person.sync({ force: true });
            const inserts = [
              { id: 1, systemId: 1, system: 'system1', name: 'Alice' }
            ];
            const people0 = await Person.bulkCreate(inserts);
            expect(people0.length).to.equal(1);
            expect(people0[0].systemId).to.equal(1);
            expect(people0[0].system).to.equal('system1');
            expect(people0[0].name).to.equal('Alice');

            const updates = [
              { id: 1, systemId: 1, system: 'system1', name: 'CHANGED NAME' },
              { id: 2, systemId: 1, system: 'system2', name: 'Bob' }
            ];

            const people = await Person.bulkCreate(updates, { updateOnDuplicate: ['systemId', 'system', 'name'] });
            expect(people.length).to.equal(2);
            expect(people[0].systemId).to.equal(1);
            expect(people[0].system).to.equal('system1');
            expect(people[0].name).to.equal('CHANGED NAME');
            expect(people[1].systemId).to.equal(1);
            expect(people[1].system).to.equal('system2');
            expect(people[1].name).to.equal('Bob');
          });

          it('[#12516] when the primary key column names and model field names are different and have composite unique index constraints', async function() {
            const Person = this.sequelize.define(
              'Person',
              {
                id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  autoIncrement: true,
                  primaryKey: true,
                  field: 'id'
                },
                systemId: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  field: 'system_id'
                },
                system: {
                  type: DataTypes.STRING,
                  allowNull: false,
                  field: 'system'
                },
                name: {
                  type: DataTypes.STRING,
                  allowNull: false,
                  field: 'name'
                }
              },
              {
                indexes: [
                  {
                    unique: true,
                    fields: ['system_id', 'system']
                  }
                ]
              }
            );

            await Person.sync({ force: true });
            const inserts = [{ systemId: 1, system: 'system1', name: 'Alice' }];
            const people0 = await Person.bulkCreate(inserts);
            expect(people0.length).to.equal(1);
            expect(people0[0].systemId).to.equal(1);
            expect(people0[0].system).to.equal('system1');
            expect(people0[0].name).to.equal('Alice');

            const updates = [
              { systemId: 1, system: 'system1', name: 'CHANGED NAME' },
              { systemId: 1, system: 'system2', name: 'Bob' }
            ];

            const people = await Person.bulkCreate(updates, {
              updateOnDuplicate: ['systemId', 'system', 'name']
            });
            expect(people.length).to.equal(2);
            expect(people[0].systemId).to.equal(1);
            expect(people[0].system).to.equal('system1');
            expect(people[0].name).to.equal('CHANGED NAME');
            expect(people[1].systemId).to.equal(1);
            expect(people[1].system).to.equal('system2');
            expect(people[1].name).to.equal('Bob');
          });
        });


        it('should reject for non array updateOnDuplicate option', async function() {
          const data = [
            { uniqueName: 'Peter', secretValue: '42' },
            { uniqueName: 'Paul', secretValue: '23' }
          ];

          await expect(
            this.User.bulkCreate(data, { updateOnDuplicate: true })
          ).to.be.rejectedWith('updateOnDuplicate option only supports non-empty array.');
        });

        it('should reject for empty array updateOnDuplicate option', async function() {
          const data = [
            { uniqueName: 'Peter', secretValue: '42' },
            { uniqueName: 'Paul', secretValue: '23' }
          ];

          await expect(
            this.User.bulkCreate(data, { updateOnDuplicate: [] })
          ).to.be.rejectedWith('updateOnDuplicate option only supports non-empty array.');
        });

        if (current.dialect.supports.inserts.conflictFields) {
          it('should respect the conflictAttributes option', async function() {
            const Permissions = this.sequelize.define(
              'permissions',
              {
                userId: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  field: 'user_id'
                },
                permissions: {
                  type: new DataTypes.ENUM('owner', 'admin', 'member'),
                  allowNull: false,
                  default: 'member'
                }
              },
              {
                timestamps: false
              }
            );

            await Permissions.sync({ force: true });

            // We don't want to create this index with the table, since we don't want our sequelize instance
            // to know it exists.  This prevents it from being inferred.
            await this.sequelize.queryInterface.addIndex(
              'permissions',
              ['user_id'],
              {
                unique: true
              }
            );

            const initialPermissions = [
              {
                userId: 1,
                permissions: 'member'
              },
              {
                userId: 2,
                permissions: 'admin'
              },
              {
                userId: 3,
                permissions: 'owner'
              }
            ];

            const initialResults = await Permissions.bulkCreate(initialPermissions, {
              conflictAttributes: ['userId'],
              updateOnDuplicate: ['permissions']
            });

            expect(initialResults.length).to.eql(3);

            for (let i = 0; i < 3; i++) {
              const result = initialResults[i];
              const exp = initialPermissions[i];

              expect(result).to.not.eql(null);
              expect(result.userId).to.eql(exp.userId);
              expect(result.permissions).to.eql(exp.permissions);
            }

            const newPermissions = [
              {
                userId: 1,
                permissions: 'owner'
              },
              {
                userId: 2,
                permissions: 'member'
              },
              {
                userId: 3,
                permissions: 'admin'
              }
            ];

            const newResults = await Permissions.bulkCreate(newPermissions, {
              conflictAttributes: ['userId'],
              updateOnDuplicate: ['permissions']
            });

            expect(newResults.length).to.eql(3);

            for (let i = 0; i < 3; i++) {
              const result = newResults[i];
              const exp = newPermissions[i];

              expect(result).to.not.eql(null);
              expect(result.id).to.eql(initialResults[i].id);
              expect(result.userId).to.eql(exp.userId);
              expect(result.permissions).to.eql(exp.permissions);
            }
          });

          describe('conflictWhere', () => {
            const Memberships = current.define(
              'memberships',
              {
                // ID of the member (no foreign key constraint for testing purposes)
                user_id: DataTypes.INTEGER,
                // ID of what the member is a member of
                foreign_id: DataTypes.INTEGER,
                time_deleted: DataTypes.DATE
              },
              {
                createdAt: false,
                updatedAt: false,
                deletedAt: 'time_deleted',
                indexes: [
                  {
                    fields: ['user_id', 'foreign_id'],
                    unique: true,
                    where: { time_deleted: null }
                  }
                ]
              }
            );

            const options = {
              conflictWhere: { time_deleted: null },
              conflictAttributes: ['user_id', 'foreign_id'],
              updateOnDuplicate: ['user_id', 'foreign_id', 'time_deleted']
            };

            beforeEach(() => Memberships.sync({ force: true }));

            it('should insert items with conflictWhere', async () => {
              const memberships = new Array(10).fill().map((_, i) => ({
                user_id: i + 1,
                foreign_id: i + 20,
                time_deleted: null
              }));

              const results = await Memberships.bulkCreate(
                memberships,
                options
              );

              for (let i = 0; i < 10; i++) {
                expect(results[i].user_id).to.eq(memberships[i].user_id);
                expect(results[i].team_id).to.eq(memberships[i].team_id);
                expect(results[i].time_deleted).to.eq(null);
              }
            });

            it('should not conflict with soft deleted memberships', async () => {
              const memberships = new Array(10).fill().map((_, i) => ({
                user_id: i + 1,
                foreign_id: i + 20,
                time_deleted: new Date()
              }));

              let results = await Memberships.bulkCreate(memberships, options);

              for (let i = 0; i < 10; i++) {
                expect(results[i].user_id).to.eq(memberships[i].user_id);
                expect(results[i].team_id).to.eq(memberships[i].team_id);
                expect(results[i].time_deleted).to.not.eq(null);
              }

              results = await Memberships.bulkCreate(
                memberships.map(membership => ({
                  ...membership,
                  time_deleted: null
                })),
                options
              );

              for (let i = 0; i < 10; i++) {
                expect(results[i].user_id).to.eq(memberships[i].user_id);
                expect(results[i].team_id).to.eq(memberships[i].team_id);
                expect(results[i].time_deleted).to.eq(null);
              }

              const count = await Memberships.count();

              expect(count).to.eq(20);
            });

            it('should upsert existing memberships', async () => {
              const memberships = new Array(10).fill().map((_, i) => ({
                user_id: i + 1,
                foreign_id: i + 20,
                time_deleted: i % 2 ? new Date() : null
              }));

              let results = await Memberships.bulkCreate(memberships, options);

              for (let i = 0; i < 10; i++) {
                expect(results[i].user_id).to.eq(memberships[i].user_id);
                expect(results[i].team_id).to.eq(memberships[i].team_id);
                if (i % 2) {
                  expect(results[i].time_deleted).to.not.eq(null);
                } else {
                  expect(results[i].time_deleted).to.eq(null);
                }
              }

              for (const membership of memberships) {
                membership.time_deleted;
              }

              results = await Memberships.bulkCreate(
                memberships.map(membership => ({
                  ...membership,
                  time_deleted: null
                })),
                options
              );

              for (let i = 0; i < 10; i++) {
                expect(results[i].user_id).to.eq(memberships[i].user_id);
                expect(results[i].team_id).to.eq(memberships[i].team_id);
                expect(results[i].time_deleted).to.eq(null);
              }

              const count = await Memberships.count({ paranoid: false });

              expect(count).to.eq(15);
            });
          });

          if (
            current.dialect.supports.inserts.onConflictWhere
          ) {
            describe('conflictWhere', () => {
              const Memberships = current.define(
                'memberships',
                {
                  // ID of the member (no foreign key constraint for testing purposes)
                  user_id: DataTypes.INTEGER,
                  // ID of what the member is a member of
                  foreign_id: DataTypes.INTEGER,
                  time_deleted: DataTypes.DATE
                },
                {
                  createdAt: false,
                  updatedAt: false,
                  deletedAt: 'time_deleted',
                  indexes: [
                    {
                      fields: ['user_id', 'foreign_id'],
                      unique: true,
                      where: { time_deleted: null }
                    }
                  ]
                }
              );

              const options = {
                conflictWhere: { time_deleted: null },
                conflictAttributes: ['user_id', 'foreign_id'],
                updateOnDuplicate: ['user_id', 'foreign_id', 'time_deleted']
              };

              beforeEach(() => Memberships.sync({ force: true }));

              it('should insert items with conflictWhere', async () => {
                const memberships = new Array(10).fill().map((_, i) => ({
                  user_id: i + 1,
                  foreign_id: i + 20,
                  time_deleted: null
                }));

                const results = await Memberships.bulkCreate(
                  memberships,
                  options
                );

                for (let i = 0; i < 10; i++) {
                  expect(results[i].user_id).to.eq(memberships[i].user_id);
                  expect(results[i].team_id).to.eq(memberships[i].team_id);
                  expect(results[i].time_deleted).to.eq(null);
                }
              });

              it('should not conflict with soft deleted memberships', async () => {
                const memberships = new Array(10).fill().map((_, i) => ({
                  user_id: i + 1,
                  foreign_id: i + 20,
                  time_deleted: new Date()
                }));

                let results = await Memberships.bulkCreate(memberships, options);

                for (let i = 0; i < 10; i++) {
                  expect(results[i].user_id).to.eq(memberships[i].user_id);
                  expect(results[i].team_id).to.eq(memberships[i].team_id);
                  expect(results[i].time_deleted).to.not.eq(null);
                }

                results = await Memberships.bulkCreate(
                  memberships.map(membership => ({
                    ...membership,
                    time_deleted: null
                  })),
                  options
                );

                for (let i = 0; i < 10; i++) {
                  expect(results[i].user_id).to.eq(memberships[i].user_id);
                  expect(results[i].team_id).to.eq(memberships[i].team_id);
                  expect(results[i].time_deleted).to.eq(null);
                }

                const count = await Memberships.count();

                expect(count).to.eq(20);
              });

              it('should upsert existing memberships', async () => {
                const memberships = new Array(10).fill().map((_, i) => ({
                  user_id: i + 1,
                  foreign_id: i + 20,
                  time_deleted: i % 2 ? new Date() : null
                }));

                let results = await Memberships.bulkCreate(memberships, options);

                for (let i = 0; i < 10; i++) {
                  expect(results[i].user_id).to.eq(memberships[i].user_id);
                  expect(results[i].team_id).to.eq(memberships[i].team_id);
                  if (i % 2) {
                    expect(results[i].time_deleted).to.not.eq(null);
                  } else {
                    expect(results[i].time_deleted).to.eq(null);
                  }
                }

                for (const membership of memberships) {
                  membership.time_deleted;
                }

                results = await Memberships.bulkCreate(
                  memberships.map(membership => ({
                    ...membership,
                    time_deleted: null
                  })),
                  options
                );

                for (let i = 0; i < 10; i++) {
                  expect(results[i].user_id).to.eq(memberships[i].user_id);
                  expect(results[i].team_id).to.eq(memberships[i].team_id);
                  expect(results[i].time_deleted).to.eq(null);
                }

                const count = await Memberships.count({ paranoid: false });

                expect(count).to.eq(15);
              });
            });
          }
        }
      });
    }

    if (current.dialect.supports.returnValues) {
      describe('return values', () => {
        it('should make the auto incremented values available on the returned instances', async function() {
          const User = this.sequelize.define('user', {});

          await User
            .sync({ force: true });

          const users0 = await User.bulkCreate([
            {},
            {},
            {}
          ], {
            returning: true
          });

          const actualUsers0 = await User.findAll({ order: ['id'] });
          const [users, actualUsers] = [users0, actualUsers0];
          expect(users.length).to.eql(actualUsers.length);
          users.forEach((user, i) => {
            expect(user.get('id')).to.be.ok;
            expect(user.get('id')).to.equal(actualUsers[i].get('id'))
              .and.to.equal(i + 1);
          });
        });

        it('should make the auto incremented values available on the returned instances with custom fields', async function() {
          const User = this.sequelize.define('user', {
            maId: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
              field: 'yo_id'
            }
          });

          await User
            .sync({ force: true });

          const users0 = await User.bulkCreate([
            {},
            {},
            {}
          ], {
            returning: true
          });

          const actualUsers0 = await User.findAll({ order: ['maId'] });
          const [users, actualUsers] = [users0, actualUsers0];
          expect(users.length).to.eql(actualUsers.length);
          users.forEach((user, i) => {
            expect(user.get('maId')).to.be.ok;
            expect(user.get('maId')).to.equal(actualUsers[i].get('maId'))
              .and.to.equal(i + 1);
          });
        });

        it('should only return fields that are not defined in the model (with returning: true)', async function() {
          const User = this.sequelize.define('user');

          await User
            .sync({ force: true });

          await this.sequelize.queryInterface.addColumn('users', 'not_on_model', Sequelize.STRING);

          const users0 = await User.bulkCreate([
            {},
            {},
            {}
          ], {
            returning: true
          });

          const actualUsers0 = await User.findAll();
          const [users, actualUsers] = [users0, actualUsers0];
          expect(users.length).to.eql(actualUsers.length);
          users.forEach(user => {
            expect(user.get()).not.to.have.property('not_on_model');
          });
        });

        it('should return fields that are not defined in the model (with returning: ["*"])', async function() {
          const User = this.sequelize.define('user');

          await User
            .sync({ force: true });

          await this.sequelize.queryInterface.addColumn('users', 'not_on_model', Sequelize.STRING);

          const users0 = await User.bulkCreate([
            {},
            {},
            {}
          ], {
            returning: ['*']
          });

          const actualUsers0 = await User.findAll();
          const [users, actualUsers] = [users0, actualUsers0];
          expect(users.length).to.eql(actualUsers.length);
          users.forEach(user => {
            expect(user.get()).to.have.property('not_on_model');
          });
        });
      });
    }

    describe('enums', () => {
      it('correctly restores enum values', async function() {
        const Item = this.sequelize.define('Item', {
          state: { type: Sequelize.ENUM, values: ['available', 'in_cart', 'shipped'] },
          name: Sequelize.STRING
        });

        await Item.sync({ force: true });
        await Item.bulkCreate([{ state: 'in_cart', name: 'A' }, { state: 'available', name: 'B' }]);
        const item = await Item.findOne({ where: { state: 'available' } });
        expect(item.name).to.equal('B');
      });
    });

    it('should properly map field names to attribute names', async function() {
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

      await Maya.sync({ force: true });
      const m0 = await Maya.create(M1);
      expect(m0.createdAt).to.be.ok;
      expect(m0.id).to.be.eql(M1.id);
      expect(m0.name).to.be.eql(M1.name);
      expect(m0.secret).to.be.eql(M1.secret);

      const [m] = await Maya.bulkCreate([M2]);

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

    describe('handles auto increment values', () => {
      it('should return auto increment primary key values', async function() {
        const Maya = this.sequelize.define('Maya', {});

        const M1 = {};
        const M2 = {};

        await Maya.sync({ force: true });
        const ms = await Maya.bulkCreate([M1, M2], { returning: true });
        expect(ms[0].id).to.be.eql(1);
        expect(ms[1].id).to.be.eql(2);
      });

      it('should return supplied values on primary keys', async function() {
        const User = this.sequelize.define('user', {});

        await User
          .sync({ force: true });

        const users0 = await User.bulkCreate([
          { id: 1 },
          { id: 2 },
          { id: 3 }
        ], { returning: true });

        const actualUsers0 = await User.findAll({ order: [['id', 'ASC']] });
        const [users, actualUsers] = [users0, actualUsers0];
        expect(users.length).to.eql(actualUsers.length);

        expect(users[0].get('id')).to.equal(1).and.to.equal(actualUsers[0].get('id'));
        expect(users[1].get('id')).to.equal(2).and.to.equal(actualUsers[1].get('id'));
        expect(users[2].get('id')).to.equal(3).and.to.equal(actualUsers[2].get('id'));
      });

      it('should return supplied values on primary keys when some instances already exists', async function() {
        const User = this.sequelize.define('user', {});

        await User
          .sync({ force: true });

        await User.bulkCreate([
          { id: 1 },
          { id: 3 }
        ]);

        const users = await User.bulkCreate([
          { id: 2 },
          { id: 4 },
          { id: 5 }
        ], { returning: true });

        expect(users.length).to.eql(3);

        expect(users[0].get('id')).to.equal(2);
        expect(users[1].get('id')).to.equal(4);
        expect(users[2].get('id')).to.equal(5);
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

      it('should validate', async function() {
        try {
          await this.User
            .sync({ force: true });

          await this.User.bulkCreate([
            { password: 'password' }
          ], { validate: true });

          expect.fail();
        } catch (error) {
          expect(error.errors.length).to.equal(1);
          expect(error.errors[0].message).to.match(/.*always invalid.*/);
        }
      });

      it('should not validate', async function() {
        await this.User
          .sync({ force: true });

        const users0 = await this.User.bulkCreate([
          { password: 'password' }
        ], { validate: false });

        expect(users0.length).to.equal(1);

        const users = await this.User.bulkCreate([
          { password: 'password' }
        ]);

        expect(users.length).to.equal(1);
      });
    });
  });
});
