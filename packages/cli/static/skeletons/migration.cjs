'use strict';

module.exports = {
  /** @type {import('@sequelize/cli').MigrationFunction} */
  async up(queryInterface, sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
  },

  /** @type {import('@sequelize/cli').MigrationFunction} */
  async down(queryInterface, sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  },
};
