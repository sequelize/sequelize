import {
  AggregateError,
  DataTypes,
  DatabaseError,
  ForeignKeyConstraintError,
  Model,
  OptimisticLockError,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationError,
  ValidationErrorItem,
} from '@sequelize/core';
import { assert, expect } from 'chai';
import { spy } from 'sinon';
import {
  allowDeprecationsInSuite,
  getTestDialect,
  getTestDialectTeaser,
  sequelize,
} from './support';

const dialect = getTestDialect();
const queryInterface = sequelize.queryInterface;

describe(getTestDialectTeaser('Sequelize Errors'), () => {
  describe('API Surface', () => {
    it('SequelizeValidationErrorItem should have instance, key & validator properties when given to constructor', () => {
      class Inst extends Model {}

      Inst.init({}, { sequelize });
      const inst = Inst.build();
      const vargs = [4];
      const error = new ValidationErrorItem(
        'error!',
        'FUNCTION',
        'foo',
        'bar',
        inst,
        'klen',
        'len',
        vargs,
      );

      expect(error).to.have.property('instance');
      expect(error.instance).to.equal(inst);

      expect(error).to.have.property('validatorKey', 'klen');
      expect(error).to.have.property('validatorName', 'len');
      expect(error).to.have.property('validatorArgs', vargs);
    });
  });

  describe('OptimisticLockError', () => {
    it('got correct error type and message', async () => {
      class User extends Model {
        declare id: number;
        declare number: number;
      }

      const Account = sequelize.define<User>(
        'Account',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          number: {
            type: DataTypes.INTEGER,
          },
        },
        {
          version: true,
        },
      );

      await Account.sync({ force: true });
      const result = (async () => {
        const accountA = await Account.create({ number: 1 });
        const accountB = await Account.findByPk(accountA.id);
        accountA.number += 1;
        await accountA.save();
        if (!accountB) {
          throw new Error('accountB is null');
        }

        accountB.number += 1;

        return accountB.save();
      })();

      await Promise.all([
        expect(result).to.eventually.be.rejectedWith(OptimisticLockError),
        expect(result).to.eventually.be.rejectedWith(
          'Attempting to update a stale model instance: Account',
        ),
      ]);
    });
  });

  describe('ConstraintError', () => {
    allowDeprecationsInSuite(['SEQUELIZE0007']);

    for (const constraintTest of [
      {
        type: 'UniqueConstraintError',
        exception: UniqueConstraintError,
      },
      {
        type: 'ValidationError',
        exception: ValidationError,
      },
    ]) {
      it(`Can be intercepted as ${constraintTest.type} using .catch`, async () => {
        const userSpy = spy();
        const User = sequelize.define('user', {
          first_name: {
            type: DataTypes.STRING,
            unique: 'unique_name',
          },
          last_name: {
            type: DataTypes.STRING,
            unique: 'unique_name',
          },
        });

        const record = { first_name: 'jan', last_name: 'meier' };
        await sequelize.sync({ force: true });
        await User.create(record);

        try {
          await User.create(record);
        } catch (error) {
          if (!(error instanceof constraintTest.exception)) {
            throw error;
          }

          await userSpy(error);
        }

        expect(userSpy).to.have.been.calledOnce;
      });
    }

    // IBM i doesn't support newlines in identifiers
    if (dialect !== 'ibmi') {
      it('Supports newlines in keys', async () => {
        const userSpy = spy();
        const User = sequelize.define('user', {
          name: {
            type: DataTypes.STRING,
            unique: 'unique \n unique',
          },
        });

        await sequelize.sync({ force: true });
        await User.create({ name: 'jan' });

        try {
          await User.create({ name: 'jan' });
        } catch (error) {
          if (!(error instanceof UniqueConstraintError)) {
            throw error;
          }

          await userSpy(error);
        }

        expect(userSpy).to.have.been.calledOnce;
      });

      it('Works when unique keys are not defined in sequelize', async () => {
        let User = sequelize.define(
          'user',
          {
            name: {
              type: DataTypes.STRING,
              unique: 'unique \n unique',
            },
          },
          { timestamps: false },
        );

        await sequelize.sync({ force: true });
        // Now let's pretend the index was created by someone else, and sequelize doesn't know about it
        User = sequelize.define(
          'user',
          {
            name: DataTypes.STRING,
          },
          { timestamps: false },
        );

        await User.create({ name: 'jan' });
        // It should work even though the unique key is not defined in the model
        await expect(User.create({ name: 'jan' })).to.be.rejectedWith(UniqueConstraintError);

        // And when the model is not passed at all
        if (['db2', 'ibmi'].includes(dialect)) {
          await expect(
            sequelize.query('INSERT INTO "users" ("name") VALUES (\'jan\')'),
          ).to.be.rejectedWith(UniqueConstraintError);
        } else {
          await expect(
            sequelize.query("INSERT INTO users (name) VALUES ('jan')"),
          ).to.be.rejectedWith(UniqueConstraintError);
        }
      });
    }

    it('adds parent and sql properties', async () => {
      const User = sequelize.define(
        'user',
        {
          name: {
            type: DataTypes.STRING,
            unique: 'unique',
          },
        },
        { timestamps: false },
      );

      await sequelize.sync({ force: true });
      await User.create({ name: 'jan' });
      // Unique key
      const error0 = await expect(User.create({ name: 'jan' })).to.be.rejected;
      expect(error0).to.be.instanceOf(UniqueConstraintError);
      expect(error0).to.have.property('parent');
      expect(error0).to.have.property('original');
      expect(error0).to.have.property('sql');

      await User.create({ id: 2, name: 'jon' });
      // Primary key
      const error = await expect(User.create({ id: 2, name: 'jon' })).to.be.rejected;
      expect(error).to.be.instanceOf(UniqueConstraintError);
      expect(error).to.have.property('parent');
      expect(error).to.have.property('original');
      expect(error).to.have.property('sql');
    });
  });

  describe('Query Errors', () => {
    it('should throw a unique constraint error for unique constraints', async () => {
      await queryInterface.createTable('Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
      });

      try {
        await queryInterface.bulkInsert('Users', [{ username: 'foo' }, { username: 'foo' }]);
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        assert(error instanceof ValidationError);
        if (dialect === 'db2') {
          expect(error.errors).to.have.length(0);
        } else {
          expect(error.errors).to.have.length(1);
          expect(error.errors[0].type).to.equal('unique violation');
          if (dialect === 'sqlite') {
            expect(error.errors[0].value).to.be.null;
          } else {
            expect(error.errors[0].value).to.equal('foo');
          }
        }

        assert(error.cause instanceof Error);

        switch (dialect) {
          case 'db2':
            expect(error.cause.message).to.contain(
              'One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "1" constrains table "DB2INST1.Users" from having duplicate values for the index key.',
            );
            break;

          case 'mssql':
            expect(error.cause.message).to.match(
              /Violation of UNIQUE KEY constraint 'UQ__Users__\w+'\. Cannot insert duplicate key in object 'dbo.Users'\. The duplicate key value is \(foo\)\./,
            );
            expect(error.errors[0].path).to.match(/UQ__Users__\w+/);
            expect(error.errors[0].message).to.match(/UQ__Users__\w+ must be unique/);
            break;

          case 'mysql':
            expect(error.cause.message).to.match(
              /Duplicate entry 'foo' for key '(?:Users.)?username'/,
            );
            expect(error.errors[0].path).to.equal('username');
            expect(error.errors[0].message).to.equal('username must be unique');
            break;

          case 'postgres':
            expect(error.cause.message).to.equal(
              'duplicate key value violates unique constraint "Users_username_key"',
            );
            expect(error.errors[0].path).to.equal('username');
            expect(error.errors[0].message).to.equal('username must be unique');
            break;

          case 'sqlite':
            expect(error.cause.message).to.equal(
              'SQLITE_CONSTRAINT: UNIQUE constraint failed: Users.username',
            );
            expect(error.errors[0].path).to.equal('username');
            expect(error.errors[0].message).to.equal('username must be unique');
            break;

          default:
            expect(error.cause.message).to.contain("Duplicate entry 'foo' for key 'username'");
            expect(error.errors[0].path).to.equal('username');
            expect(error.errors[0].message).to.equal('username must be unique');
        }
      }
    });

    it('should throw a unique constraint error for unique indexes', async () => {
      await queryInterface.createTable('Users', {
        username: DataTypes.STRING,
      });

      await queryInterface.addIndex('Users', {
        fields: ['username'],
        unique: true,
      });

      try {
        await queryInterface.bulkInsert('Users', [{ username: 'foo' }, { username: 'foo' }]);
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        assert(error instanceof ValidationError);
        if (dialect === 'db2') {
          expect(error.errors).to.have.length(0);
        } else {
          expect(error.errors).to.have.length(1);
          expect(error.errors[0].message).to.match(
            /(?:users_username_unique|username) must be unique/,
          );
          expect(error.errors[0].type).to.equal('unique violation');
          expect(error.errors[0].path).to.match(/(?:users_username_unique|username)/);
          if (dialect === 'sqlite') {
            expect(error.errors[0].value).to.be.null;
          } else {
            expect(error.errors[0].value).to.equal('foo');
          }
        }

        assert(error.cause instanceof Error);

        switch (dialect) {
          case 'db2':
            expect(error.cause.message).to.contain(
              'One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "1" constrains table "DB2INST1.Users" from having duplicate values for the index key.',
            );
            break;

          case 'mssql':
            expect(error.cause.message).to.equal(
              "Cannot insert duplicate key row in object 'dbo.Users' with unique index 'users_username_unique'. The duplicate key value is (foo).",
            );
            break;

          case 'mysql':
            expect(error.cause.message).to.match(
              /Duplicate entry 'foo' for key '(?:Users.)?users_username_unique'/,
            );
            break;

          case 'postgres':
            expect(error.cause.message).to.equal(
              'duplicate key value violates unique constraint "users_username_unique"',
            );
            break;

          case 'sqlite':
            expect(error.cause.message).to.equal(
              'SQLITE_CONSTRAINT: UNIQUE constraint failed: Users.username',
            );
            break;

          default:
            expect(error.cause.message).to.contain(
              "Duplicate entry 'foo' for key 'users_username_unique'",
            );
        }
      }
    });

    it('should throw a foreign key constraint error when deleting a parent row that has assocated child rows', async () => {
      await queryInterface.createTable('Users', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        username: DataTypes.STRING,
      });

      await queryInterface.createTable('Tasks', {
        title: DataTypes.STRING,
        userId: { type: DataTypes.INTEGER, allowNull: false },
      });

      await queryInterface.addConstraint('Tasks', {
        fields: ['userId'],
        type: 'FOREIGN KEY',
        name: 'Tasks_userId_Users_fk',
        references: {
          table: 'Users',
          field: 'id',
        },
      });

      await queryInterface.bulkInsert('Users', [{ username: 'foo' }]);
      await queryInterface.bulkInsert('Tasks', [{ title: 'task', userId: 1 }]);
      try {
        await queryInterface.bulkDelete('Users');
      } catch (error) {
        expect(error).to.be.instanceOf(ForeignKeyConstraintError);
        assert(error instanceof ForeignKeyConstraintError);
        if (dialect === 'sqlite') {
          expect(error.index).to.be.undefined;
        } else {
          expect(error.index).to.equal('Tasks_userId_Users_fk');
        }

        switch (dialect) {
          case 'db2':
            expect(error.table).to.equal('Tasks');
            expect(error.fields).to.be.null;
            expect(error.cause.message).to.contain(
              'A parent row cannot be deleted because the relationship "DB2INST1.Tasks.Tasks_userId_Users_fk" restricts the deletion.',
            );
            break;

          case 'mssql':
            expect(error.table).to.equal('dbo.Tasks');
            expect(error.fields).to.deep.equal(['userId']);
            expect(error.cause.message).to.equal(
              'The DELETE statement conflicted with the REFERENCE constraint "Tasks_userId_Users_fk". The conflict occurred in database "sequelize_test", table "dbo.Tasks", column \'userId\'.',
            );
            break;

          case 'postgres':
            expect(error.table).to.equal('Users');
            expect(error.fields).to.be.null;
            expect(error.cause.message).to.equal(
              'update or delete on table "Users" violates foreign key constraint "Tasks_userId_Users_fk" on table "Tasks"',
            );
            break;

          case 'sqlite':
            expect(error.table).to.be.undefined;
            expect(error.fields).to.be.undefined;
            expect(error.cause.message).to.equal(
              'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed',
            );
            break;

          default:
            expect(error.table).to.equal('Users');
            expect(error.fields).to.deep.equal(['userId']);
            expect(error.cause.message).to.contain(
              'Cannot delete or update a parent row: a foreign key constraint fails (`sequelize_test`.`Tasks`, CONSTRAINT `Tasks_userId_Users_fk` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`))',
            );
        }
      }
    });

    it('should throw a foreign key constraint error when inserting a child row that has invalid parent row', async () => {
      await queryInterface.createTable('Users', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        username: DataTypes.STRING,
      });

      await queryInterface.createTable('Tasks', {
        title: DataTypes.STRING,
        userId: { type: DataTypes.INTEGER, allowNull: false },
      });

      await queryInterface.addConstraint('Tasks', {
        fields: ['userId'],
        type: 'FOREIGN KEY',
        name: 'Tasks_userId_Users_fk',
        references: {
          table: 'Users',
          field: 'id',
        },
      });

      try {
        await queryInterface.bulkInsert('Tasks', [{ title: 'task', userId: 1 }]);
      } catch (error) {
        expect(error).to.be.instanceOf(ForeignKeyConstraintError);
        assert(error instanceof ForeignKeyConstraintError);
        if (dialect === 'sqlite') {
          expect(error.index).to.be.undefined;
        } else {
          expect(error.index).to.equal('Tasks_userId_Users_fk');
        }

        switch (dialect) {
          case 'db2':
            expect(error.table).to.equal('Tasks');
            expect(error.fields).to.be.null;
            expect(error.cause.message).to.contain(
              'The insert or update value of the FOREIGN KEY "DB2INST1.Tasks.Tasks_userId_Users_fk" is not equal to any value of the parent key of the parent table.',
            );
            break;

          case 'mssql':
            expect(error.table).to.equal('dbo.Users');
            expect(error.fields).to.deep.equal(['id']);
            expect(error.cause.message).to.equal(
              'The INSERT statement conflicted with the FOREIGN KEY constraint "Tasks_userId_Users_fk". The conflict occurred in database "sequelize_test", table "dbo.Users", column \'id\'.',
            );
            break;

          case 'postgres':
            expect(error.table).to.equal('Tasks');
            expect(error.fields).to.be.null;
            expect(error.cause.message).to.equal(
              'insert or update on table "Tasks" violates foreign key constraint "Tasks_userId_Users_fk"',
            );
            break;

          case 'sqlite':
            expect(error.table).to.be.undefined;
            expect(error.fields).to.be.undefined;
            expect(error.cause.message).to.equal(
              'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed',
            );
            break;

          default:
            expect(error.table).to.equal('Users');
            expect(error.fields).to.deep.equal(['userId']);
            expect(error.cause.message).to.contain(
              'Cannot add or update a child row: a foreign key constraint fails (`sequelize_test`.`Tasks`, CONSTRAINT `Tasks_userId_Users_fk` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`))',
            );
        }
      }
    });

    it('should throw an unknown constranit error for duplicate constraint names', async () => {
      await queryInterface.createTable('Users', {
        id: { type: DataTypes.INTEGER, allowNull: false },
        username: DataTypes.STRING,
      });

      await queryInterface.addConstraint('Users', {
        type: 'PRIMARY KEY',
        fields: ['id'],
        name: 'unique_constraint',
      });

      try {
        await queryInterface.addConstraint('Users', {
          type: 'UNIQUE',
          fields: ['username'],
          name: 'unique_constraint',
        });
      } catch (error) {
        if (['mariadb', 'mssql', 'mysql', 'sqlite'].includes(dialect)) {
          expect(error).to.be.instanceOf(AggregateError);
          assert(error instanceof AggregateError);
          expect(error.errors).to.have.length(3);
          expect(error.errors[0].message).to.equal(
            "There is already an object named 'unique_constraint' in the database.",
          );
          expect(error.errors[1].message).to.equal(
            'Could not create constraint or index. See previous errors.',
          );
          assert(error.errors[2] instanceof UnknownConstraintError);
          expect(error.errors[2].constraint).to.equal('unique_constraint');
          expect(error.errors[2].table).to.equal('Users');
        } else {
          expect(error).to.be.instanceOf(DatabaseError);
          assert(error instanceof DatabaseError);
          expect(error.sql).to.match(/.+(?:Users).+(?:unique_constraint)/);
        }
      }
    });
  });
});
