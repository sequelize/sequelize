'use strict';

module.exports = {
  /** @type {import('@sequelize/cli').MigrationFunction} */
  async up({ sequelize }) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await sequelize.queryInterface.createTable('users', { id: DataTypes.INTEGER });
     */
  },

  /** @type {import('@sequelize/cli').MigrationFunction} */
  async down({ sequelize }) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await sequelize.queryInterface.dropTable('users');
     */
  },
};
