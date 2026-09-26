// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { ShowConstraintsQueryOptions, TableOrModel } from '@sequelize/core';
import type { TableNameWithSchema } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { createBindParamGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import type { OracleQueryGeneratorTypeScript } from '../query-generator-typescript.internal.js';

/**
 * Turns a value into SQL: either an escaped literal, or a bind parameter.
 */
export type ValueToSql = (value: unknown) => string;

export interface QueryWithBind {
  query: string;
  bind: Record<string, unknown>;
}

/**
 * Builds a dictionary query with its values as bind parameters instead of literals.
 * Oracle hard parses every distinct SQL text, which is slow for queries on the dictionary views,
 * so binding the table and schema names lets it reuse the parsed statement across tables.
 *
 * @param buildQuery
 */
export function withBindParams(buildQuery: (valueToSql: ValueToSql) => string): QueryWithBind {
  const bind: Record<string, unknown> = {};
  const query = buildQuery(createBindParamGenerator(bind));

  return { query, bind };
}

export function buildShowIndexesQuery(
  queryGenerator: OracleQueryGeneratorTypeScript,
  table: TableNameWithSchema,
  valueToSql: ValueToSql,
): string {
  const [tableName, owner] = queryGenerator.getSchemaNameAndTableName(table);

  return [
    'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type ',
    'FROM all_ind_columns i ',
    'INNER JOIN all_indexes u ',
    'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
    'LEFT OUTER JOIN all_constraints c ',
    'ON (c.table_name = i.table_name AND c.index_name = i.index_name) ',
    `WHERE i.table_name = ${valueToSql(tableName)}`,
    ' AND u.table_owner = ',
    owner ? valueToSql(owner) : 'USER',
    ' ORDER BY index_name, column_position',
  ].join('');
}

export function buildDescribeTableQuery(
  queryGenerator: OracleQueryGeneratorTypeScript,
  tableName: TableOrModel,
  valueToSql: ValueToSql,
): string {
  const table = queryGenerator.extractTableDetails(tableName);
  const currTableName = queryGenerator.getCatalogName(table.tableName);
  const schema = queryGenerator.getCatalogName(table.schema);

  return [
    'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type ',
    'FROM all_tab_columns atc ',
    'LEFT OUTER JOIN ',
    '(SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ',
    'ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) ',
    schema ? `WHERE (atc.OWNER = ${valueToSql(schema)}) ` : 'WHERE atc.OWNER = USER ',
    `AND (atc.TABLE_NAME = ${valueToSql(currTableName)})`,
    'ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC',
  ].join('');
}

export function buildForeignKeysQuery(
  queryGenerator: OracleQueryGeneratorTypeScript,
  table: TableOrModel,
  valueToSql: ValueToSql,
): string {
  // We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
  const tableDetails = queryGenerator.extractTableDetails(table);
  const tableName = queryGenerator.getCatalogName(tableDetails.tableName);
  const schemaName = queryGenerator.getCatalogName(tableDetails.schema);
  const sql = [
    'SELECT DISTINCT  a.table_name "tableName", a.constraint_name "constraintName", c.owner "tableSchema", a.owner "constraintSchema", a.column_name "columnNames",',
    `CASE c.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY' WHEN 'C' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END "constraintType",`,
    ' c.r_owner "referencedTableSchema",',
    ' c.DELETE_RULE "deleteAction",',
    ` 'NO ACTION' AS "updateAction",`,
    ' b.table_name "referencedTableName", b.column_name "referencedColumnNames"',
    ' FROM all_cons_columns a',
    ' JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name',
    ' JOIN all_cons_columns b ON c.r_owner = b.owner AND c.r_constraint_name = b.constraint_name',
    " WHERE c.constraint_type  = 'R'",
    ' AND a.table_name = ',
    valueToSql(tableName),
    ' AND a.owner = ',
    tableDetails.schema && schemaName !== '' ? valueToSql(schemaName) : 'USER',
    ' ORDER BY a.table_name, a.column_name, b.column_name',
  ].join('');

  return sql;
}

export function buildShowConstraintsQuery(
  queryGenerator: OracleQueryGeneratorTypeScript,
  tableName: TableOrModel,
  options: ShowConstraintsQueryOptions | undefined,
  valueToSql: ValueToSql,
): string {
  if (options && options.constraintType === 'FOREIGN KEY') {
    return buildForeignKeysQuery(queryGenerator, tableName, valueToSql);
  }

  const tableInfo = queryGenerator.extractTableDetails(tableName);
  const schema = queryGenerator.getCatalogName(tableInfo.schema);
  const table = queryGenerator.getCatalogName(tableInfo.tableName);

  return joinSQLFragments([
    'SELECT C.CONSTRAINT_NAME "constraintName",',
    `CASE A.CONSTRAINT_TYPE WHEN 'P' THEN 'PRIMARY KEY' WHEN 'R' THEN 'FOREIGN KEY' WHEN 'C' THEN 'CHECK' WHEN 'U' THEN 'UNIQUE' ELSE NULL END "constraintType",`,
    'C.TABLE_NAME "tableName",',
    'A.OWNER "tableSchema",',
    'C.OWNER "constraintSchema",',
    'C.COLUMN_NAME "columnNames",',
    'A.SEARCH_CONDITION "definition"',
    'FROM ALL_CONS_COLUMNS C',
    'INNER JOIN ALL_CONSTRAINTS A ON C.CONSTRAINT_NAME = A.CONSTRAINT_NAME',
    'AND C.OWNER = A.OWNER',
    `WHERE C.TABLE_NAME =${valueToSql(table)}`,
    `AND C.OWNER =${valueToSql(schema)}`,
    options?.constraintName ? `AND C.CONSTRAINT_NAME =${valueToSql(options.constraintName)}` : '',
    options?.constraintType
      ? `AND A.CONSTRAINT_TYPE =${valueToSql(queryGenerator.getConstraintType(options.constraintType))}`
      : '',
    'ORDER BY C.CONSTRAINT_NAME, C.POSITION',
  ]);
}
