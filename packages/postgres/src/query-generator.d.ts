import type { TableName } from '@sequelize/core';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

type PgEnumNameOptions = {
  schema?: boolean;
};

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  pgEnumName(tableName: TableName, columnName: string, options?: PgEnumNameOptions): string;
}
