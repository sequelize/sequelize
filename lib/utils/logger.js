'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

const debug = require('debug');
const util = require('util');

class Logger {
  constructor(config) {

    this.config = {
      context: 'sequelize',
      debug: true,
      ...config
    };
  }

  warn(message) {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  inspect(value) {
    return util.inspect(value, false, 1);
  }

  debugContext(name) {
    return debug(`${this.config.context}:${name}`);
  }
}

exports.logger = new Logger();

exports.Logger = Logger;
