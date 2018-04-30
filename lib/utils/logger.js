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
    this._deprecationMessages = new Set();

    this.config = Object.assign({
      context: 'sequelize',
      debug: true
    }, config || {});

    this.depd = depd(this.config.context);
    this.debug = debug(this.config.context);
  }

  static get() {
    if (!this._logger) {
      return this._logger = new Logger();
    }
    return this._logger;
  }

  deprecate(message) {
    if (this._deprecationMessages.has(message)) {
      return;
    }
    this.depd(message);
    const stack = new Error().stack.split('\n').splice(4).join('\n');
    console.warn(stack);
  }

  debug(message) {
    this.config.debug && this.debug(message);
  }

  warn(message) {
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext(childContext) {
    if (!childContext) {
      throw new Error('No context supplied to debug');
    }
    return debug([this.config.context, childContext].join(':'));
  }
}

module.exports = Logger;
