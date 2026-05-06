import type { TableName } from '@sequelize/core';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

type PgEnumNameOptions = {
  schema?: boolean;
  /** Override the auto-generated enum type name. */
  enumName?: string;
  /** Override the schema used for the enum type name prefix. */
  enumSchema?: string;
};

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  pgEnumName(tableName: TableName, columnName: string, options?: PgEnumNameOptions): string;
}
