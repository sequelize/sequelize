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
  constructor(config: LoggerConfig)
  public debug(message: string): void;
  public warn(message: string): void;
}

export const logger: Logger;
