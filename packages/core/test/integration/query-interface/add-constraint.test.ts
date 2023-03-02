import { expect } from 'chai';
import { DataTypes } from '@sequelize/core';
import { getTestDialect, sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#addForeignKeyConstraint', () => {
  it('should allow multiple fields to be defined for a FK', async () => {
    await queryInterface.createTable('users', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    });
    await queryInterface.createTable('posts', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: DataTypes.STRING,
    });

    await queryInterface.addConstraint('users', { type: 'unique', fields: ['username', 'email'] });
    await queryInterface.addConstraint('posts', {
      type: 'foreign key',
      fields: ['username', 'email'],
      references: {
        table: 'users',
        fields: ['username', 'email'],
      },
      onDelete: 'cascade',
      onUpdate: 'cascade',
    });
    const constraints = await queryInterface.showConstraint('posts');
    const constraintNames = constraints.map(constraint => constraint.name);
    expect(constraintNames).to.include('posts_username_email_users_fk');
    const constraint = constraints[0];

    if (getTestDialect() === 'sqlite') {
      expect(constraint.referenceTableName).to.eq('posts');

      return;
    }

    expect(constraint.tableName).to.eq('posts');
  });
});
