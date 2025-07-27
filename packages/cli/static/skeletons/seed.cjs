'use strict';

module.exports = {
  /** @type {import('@sequelize/cli').SeedFunction} */
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

  /** @type {import('@sequelize/cli').SeedFunction} */
  async down(queryInterface, sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  },
};
