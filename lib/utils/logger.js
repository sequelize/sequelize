'use strict';

/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

const { debuglog } = require('util');

class DebugContext {
  constructor(name) {
    this.name = name;
    this.ctx = debuglog(name);
  }

  extend(name) {
    return new DebugContext(`${this.name}:${name}`);
  }

  log(msg) {
    this.ctx(msg);
  }

  logQuery(connection, sql, pre = true) {
    this.log(`${pre ? 'executing' : 'executed'}(${connection.uuid || 'default'}): ${sql}`);
  }
}

class Logger {

  static getLogger() {
    if (this.logger) {
      return this.logger;
    }
    return this.logger = new Logger();
  }

  static warn(message) {
    return this.getLogger().warn(message);
  }

  constructor(config) {

    this.config = Object.assign({
      context: 'sequelize',
      debug: true
    }, config);

    this.debugCtx = new DebugContext(this.config.context);
  }

  warn(message) {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext() {
    return this.debugCtx;
  }
}

exports.Logger = Logger;
