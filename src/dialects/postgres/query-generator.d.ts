import { AbstractQueryGenerator } from '../abstract/query-generator.js';
import type { TableName } from '../abstract/query-interface.js';

type PgEnumNameOptions = {
  schema?: boolean,
};

export class PostgresQueryGenerator extends AbstractQueryGenerator {
  pgEnumName(tableName: TableName, columnName: string, options?: PgEnumNameOptions): string;
}
