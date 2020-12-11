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

export class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      context: 'sequelize',
      debug: true,
      ...config
    };
  }

  public warn(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  public inspect(value: any): string {
    return inspect(value, false, 3);
  }

  public debugContext(name: string): debug.Debugger {
    return debug(`${this.config.context}:${name}`);
  }
}

export const logger = new Logger();
