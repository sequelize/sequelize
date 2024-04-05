import type { DataType, TableOrModel } from '@sequelize/core';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

interface PgListEnumsOptions {
  schema?: boolean;
}

interface PgEnumNameOptions extends PgListEnumsOptions {
  noEscape?: boolean;
}

interface PgEnumOptions extends PgEnumNameOptions {
  force?: boolean;
}

interface PgEnumAddOptions {
  before: string;
  after: string;
}

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  pgEnumName(tableName: TableOrModel, columnName: string, options?: PgEnumNameOptions): string;
  pgListEnums(tableName?: TableOrModel, columnName?: string, options?: PgListEnumsOptions): string;
  pgEnum(
    tableName: TableOrModel,
    columnName: string,
    dataType: DataType,
    options?: PgEnumOptions,
  ): string;
  pgEnumAdd(
    tableName: TableOrModel,
    columnName: string,
    value: string,
    options: PgEnumAddOptions,
  ): string;
  pgEnumDrop(tableName: TableOrModel, columnName: string, enumName: string): string;
}
