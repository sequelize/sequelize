'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

const depd = require('depd');
const debug = require('debug');

class Logger {
  constructor(config) {

    this.config = Object.assign({
      context: 'sequelize',
      debug: true
    }, config);

    this.depd = depd(this.config.context);
    this.debug = debug(this.config.context);
  }

  deprecate(message) {
    this.depd(message);
  }

  debug(message) {
    if (this.config.debug) {
      this.debug(message);
    }
  }

  warn(message) {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext(childContext) {
    if (!childContext) {
      throw new Error('No context supplied to debug');
    }
    return debug([this.config.context, childContext].join(':'));
  }
}

exports.Logger = Logger;

const logger = new Logger();

exports.deprecate = logger.deprecate.bind(logger);
exports.warn = logger.warn.bind(logger);
exports.getLogger = () =>  logger ;
