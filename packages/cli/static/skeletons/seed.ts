import { UmzugContext } from '@sequelize/cli';

export async function up({ sequelize }: UmzugContext): Promise<void> {
  /**
   * Add seed commands here.
   *
   * Example:
   * await sequelize.queryInterface.bulkInsert('People', [{
   *   name: 'John Doe',
   *   isBetaMember: false
   * }], {});
   */
}

export async function down({ sequelize }: UmzugContext): Promise<void> {
  /**
   * Add commands to revert seed here.
   *
   * Example:
   * await sequelize.queryInterface.bulkDelete('People', null, {});
   */
}
