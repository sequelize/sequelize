import type { TableNameOrModel } from '../abstract/query-generator-typescript.js';
import { SqliteQueryGeneratorTypeScript } from './query-generator-typescript.js';

export class SqliteQueryGenerator extends SqliteQueryGeneratorTypeScript {

  describeCreateTableQuery(tableName: TableNameOrModel): string;
}
