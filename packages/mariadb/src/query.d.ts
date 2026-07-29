import { AbstractQuery } from '@sequelize/core';

/**
 * The subset of the mariadb driver's `ColumnDefinition` that we rely on.
 * The driver does not expose the type in its own typings.
 */
interface ColumnMetadata {
  /** The alias the column has in the result set. */
  name(): string;
  /** The name the column has in its table. */
  orgName(): string;
  /** The table the column originates from. */
  orgTable(): string;
  /** Whether the server reported the column's extended type as `json`. */
  isDataTypeFormatJson(): boolean;
}

export class MariaDbQuery extends AbstractQuery {
  /**
   * Decodes the JSON columns of a result set that the server returned as strings.
   * `rows` is mutated in place.
   *
   * @param rows The rows returned by the driver, carrying the result-set metadata on `meta`.
   */
  handleJsonSelectQuery(
    rows: Array<Record<string, unknown>> & { meta?: ColumnMetadata[] | undefined },
  ): void;
}
