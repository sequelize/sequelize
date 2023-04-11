import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.js';
import type { TableName } from '../abstract/query-interface.js';

type PgEnumNameOptions = {
  schema?: boolean,
};

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  pgEnumName(tableName: TableName, columnName: string, options?: PgEnumNameOptions): string;
}
