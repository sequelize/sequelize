import { expect } from 'chai';
import { DataTypes } from '@sequelize/core';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#addForeignKeyConstraint', () => {
  it('should allow multiple fields to be defined for a FK', async () => {
    const columns = { username: DataTypes.STRING, email: DataTypes.STRING };
    await queryInterface.createTable('users', columns);
    await queryInterface.createTable('posts', columns);

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
    const constraintNames = constraints.map(constraint => constraint.constraintName);
    expect(constraintNames).to.include('posts_username_email_users_fk');
    await queryInterface.removeConstraint('posts', 'posts_username_email_users_fk');
  });
});
