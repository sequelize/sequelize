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

export interface DebugContext {

}

export class Logger {
  static getLogger(): Logger;
  static warn(message: string): void;
  constructor(config: LoggerConfig)
  public debug(message: string): void;
  public debugContext(): DebugContext;
}
