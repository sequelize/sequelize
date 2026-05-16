'use strict';

module.exports = {
  /** @type {import('@sequelize/cli').MigrationFunction} */
  async up(queryInterface, sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
  },

  /** @type {import('@sequelize/cli').MigrationFunction} */
  async down(queryInterface, sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
