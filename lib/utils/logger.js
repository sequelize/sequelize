'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

const depd = require('depd'),
  debug = require('debug'),
  _ = require('lodash');

class Logger {
  constructor(config) {

    this.config = _.extend({
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
    this.depd(message);
    console.warn(new Error().stack.split('\n').slice(2).join('\n'));
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
