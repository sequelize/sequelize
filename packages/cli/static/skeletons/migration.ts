import { UmzugContext } from '@sequelize/cli';

export async function up({ sequelize }: UmzugContext): Promise<void> {
  /**
   * Add altering commands here.
   *
   * Example:
   * await sequelize.queryInterface.createTable('users', { id: DataTypes.INTEGER });
   */
}

export async function down({ sequelize }: UmzugContext): Promise<void> {
  /**
   * Add reverting commands here.
   *
   * Example:
   * await sequelize.queryInterface.dropTable('users');
   */
}
