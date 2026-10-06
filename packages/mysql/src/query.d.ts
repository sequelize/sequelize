import { AbstractQuery } from '@sequelize/core';

export class MySqlQuery extends AbstractQuery {
  /**
   * Turns the driver's response into the value the caller of this query receives.
   *
   * @param data The response the driver returned for this query.
   *
   * @internal
   */
  formatResults(data: unknown): unknown;
}
