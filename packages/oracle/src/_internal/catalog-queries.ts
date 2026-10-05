// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

import type { TableNameWithSchema } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-interface.js';
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
