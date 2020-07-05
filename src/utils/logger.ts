/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

import debug from 'debug';
import { inspect } from 'util';

interface LoggerConfig {
  context?: string;
  debug?: boolean;
}

class Logger {
  config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      context: 'sequelize',
      debug: true,
      ...config
    };
  }

  warn(message: string) {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  inspect(value: object) {
    return inspect(value, false, 3);
  }

  debugContext(name: string) {
    return debug(`${this.config.context}:${name}`);
  }
}

exports.logger = new Logger();

exports.Logger = Logger;
