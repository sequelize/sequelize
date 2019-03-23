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
  public debugContext(message: string): (message: string) => void;
}

export function warn(message: string): void;
export function getLogger(): Logger;
