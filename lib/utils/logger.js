'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

const debug = require('debug');

class Logger {
  static warn(message) {
    return logger.warn(message);
  }

  constructor(config) {

    this.config = Object.assign({
      context: 'sequelize',
      debug: true
    }, config);
  }

  warn(message) {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext(name) {
    return debug(`${this.config.context}:${name}`);
  }
}

const logger = exports.logger = new Logger();

exports.Logger = Logger;
