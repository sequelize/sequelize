import type { DataType, TableOrModel } from '@sequelize/core';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

interface PgListEnumsOptions {
  schema?: boolean;
  /** Override the auto-generated enum type name. */
  enumName?: string | undefined;
  /** Override the schema used for the enum type name prefix. */
  enumSchema?: string | undefined;
}

interface PgEnumNameOptions extends PgListEnumsOptions {
  noEscape?: boolean;
}

interface PgEnumOptions extends PgEnumNameOptions {
  force?: boolean;
}

interface PgEnumAddOptions extends PgListEnumsOptions {
  before?: string | null;
  after?: string | null;
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
  pgEnumDrop(tableName: TableOrModel, columnName: string): string;
  pgEnumDrop(tableName: TableOrModel | null, columnName: string | null, enumName: string): string;
  dataTypeMapping(tableName: TableOrModel, columnName: string, dataType: string): string;
  changeColumnQuery(tableName: TableOrModel, attributes: Record<string, string>): string;
}
