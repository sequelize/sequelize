'use strict';

module.exports = {
  /** @type {import('@sequelize/cli').MigrationFunction} */
  async up({ sequelize }) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await sequelize.queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
  },

  /** @type {import('@sequelize/cli').MigrationFunction} */
  async down({ sequelize }) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await sequelize.queryInterface.bulkDelete('People', null, {});
     */
  },
};
