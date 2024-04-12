import { AbstractQueryInterface, Sequelize } from '@sequelize/core';

export async function up(
  queryInterface: AbstractQueryInterface,
  sequelize: Sequelize,
): Promise<void> {
  /**
   * Add seed commands here.
   *
   * Example:
   * await queryInterface.bulkInsert('People', [{
   *   name: 'John Doe',
   *   isBetaMember: false
   * }], {});
   */
}

export async function down(
  queryInterface: AbstractQueryInterface,
  sequelize: Sequelize,
): Promise<void> {
  /**
   * Add commands to revert seed here.
   *
   * Example:
   * await queryInterface.bulkDelete('People', null, {});
   */
}
