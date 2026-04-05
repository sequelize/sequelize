import { AbstractQueryInterface, Sequelize } from '@sequelize/core';

export async function up(
  queryInterface: AbstractQueryInterface,
  sequelize: Sequelize,
): Promise<void> {
  /**
   * Add altering commands here.
   *
   * Example:
   * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
   */
}

export async function down(
  queryInterface: AbstractQueryInterface,
  sequelize: Sequelize,
): Promise<void> {
  /**
   * Add reverting commands here.
   *
   * Example:
   * await queryInterface.dropTable('users');
   */
}
