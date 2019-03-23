'use strict';

/**
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * This means that errors can be accessed using `Sequelize.ValidationError`
 * The Base Error all Sequelize Errors inherit from.
 */
class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SequelizeBaseError';
  }
}

module.exports = BaseError;
