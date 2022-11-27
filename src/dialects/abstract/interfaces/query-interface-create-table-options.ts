import type { QueryRawOptions } from '../../sequelize';
import type CollateCharsetOptions from './CollateCharsetOptions';

export default interface QueryInterfaceCreateTableOptions extends QueryRawOptions, CollateCharsetOptions {
  engine?: string;
  /**
   * Used for compound unique keys.
   */
  uniqueKeys?: {
    [keyName: string]: {
      fields: string[],
      customIndex?: boolean,
    },
  };
}
