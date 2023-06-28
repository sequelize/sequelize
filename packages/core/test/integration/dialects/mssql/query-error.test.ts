import { assert, expect } from 'chai';
import {
  AggregateError,
  DataTypes,
  ForeignKeyConstraintError,
  UnknownConstraintError,
  ValidationError,
} from '@sequelize/core';
import { sequelize } from '../../support';

const queryInterface = sequelize.queryInterface;
const dialect = sequelize.getDialect();

describe('[MSSQL Specific] Query Errors', () => {
  if (dialect !== 'mssql') {
    return;
  }

  it('should throw a unique constraint error for unique constraints', async () => {
    await queryInterface.createTable('Users', {
      username: {
        type: DataTypes.STRING,
        unique: true,
      },
    });

    try {
      await queryInterface.bulkInsert('Users', [{ username: 'foo' }, { username: 'foo' }]);
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      assert(error instanceof ValidationError);
      expect(error.cause.message).to.match(/Violation of UNIQUE KEY constraint 'UQ__Users__\w+'\. Cannot insert duplicate key in object 'dbo.Users'\. The duplicate key value is \(foo\)\./);
      expect(error.errors).to.have.length(1);
      expect(error.errors[0].message).to.match(/UQ__Users__\w+ must be unique/);
      expect(error.errors[0].type).to.equal('unique violation');
      expect(error.errors[0].path).to.match(/UQ__Users__\w+/);
      expect(error.errors[0].value).to.equal('foo');
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
      expect(error.cause.message).to.equal('Cannot insert duplicate key row in object \'dbo.Users\' with unique index \'users_username_unique\'. The duplicate key value is (foo).');
      expect(error.errors).to.have.length(1);
      expect(error.errors[0].message).to.equal('users_username_unique must be unique');
      expect(error.errors[0].type).to.equal('unique violation');
      expect(error.errors[0].path).to.equal('users_username_unique');
      expect(error.errors[0].value).to.equal('foo');
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
      await queryInterface.bulkDelete('Users', {});
    } catch (error) {
      expect(error).to.be.instanceOf(ForeignKeyConstraintError);
      assert(error instanceof ForeignKeyConstraintError);
      expect(error.cause.message).to.equal('The DELETE statement conflicted with the REFERENCE constraint "Tasks_userId_Users_fk". The conflict occurred in database "sequelize_test", table "dbo.Tasks", column \'userId\'.');
      expect(error.index).to.equal('Tasks_userId_Users_fk');
      expect(error.table).to.equal('dbo.Tasks');
      expect(error.fields).to.deep.equal(['userId']);
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
      expect(error.cause.message).to.equal('The INSERT statement conflicted with the FOREIGN KEY constraint "Tasks_userId_Users_fk". The conflict occurred in database "sequelize_test", table "dbo.Users", column \'id\'.');
      expect(error.index).to.equal('Tasks_userId_Users_fk');
      expect(error.table).to.equal('dbo.Users');
      expect(error.fields).to.deep.equal(['id']);
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
      expect(error).to.be.instanceOf(AggregateError);
      assert(error instanceof AggregateError);
      expect(error.errors).to.have.length(3);
      expect(error.errors[0].message).to.equal('There is already an object named \'unique_constraint\' in the database.');
      expect(error.errors[1].message).to.equal('Could not create constraint or index. See previous errors.');
      assert(error.errors[2] instanceof UnknownConstraintError);
      expect(error.errors[2].constraint).to.equal('unique_constraint');
      expect(error.errors[2].table).to.equal('Users');
    }
  });
});
