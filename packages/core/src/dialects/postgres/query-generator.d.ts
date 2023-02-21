import type { TableName } from '../abstract/query-interface.js';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.js';

type PgEnumNameOptions = {
  schema?: boolean,
};

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  pgEnumName(tableName: TableName, columnName: string, options?: PgEnumNameOptions): string;
}
