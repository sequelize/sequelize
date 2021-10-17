'use strict';

/**
 * @file Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @access package
 */
import nodeDebug from 'debug';
import util from 'util';

export interface LoggerConfig {
  /**
   * @default `sequelize`
   */
  context?: string;
  /**
   * @default `true`
   */
  debug?: boolean;
}

export class Logger {
  protected config: {
    context: string;
    debug: boolean;
  };

  constructor(
    { context = 'sequelize', debug = true, ...rest }: LoggerConfig = {
      context: 'sequelize',
      debug: true
    }
  ) {
    this.config = {
      context,
      debug,
      ...rest
    };
  }

  warn(message: string): void {
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  inspect(value: unknown): string {
    return util.inspect(value, false, 3);
  }

  debugContext(name: string): nodeDebug.Debugger {
    return nodeDebug(`${this.config.context}:${name}`);
  }
}

export const logger = new Logger();
