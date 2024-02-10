import { inspect } from 'node:util';
import { Col } from '../../expression-builders/col.js';
import { Literal } from '../../expression-builders/literal.js';
import type { AttributeOptions } from '../../model.js';
import { joinSQLFragments } from '../../utils/join-sql-fragments.js';
import { attributeTypeToSql } from '../abstract/data-types-utils.js';
import { VIRTUAL } from '../abstract/data-types.js';
import { AbstractQueryGeneratorInternal } from '../abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions, GetReturnFieldsOptions } from '../abstract/query-generator.types.js';
import type { MssqlDialect } from './index.js';

const TECHNICAL_DATABASE_NAMES = Object.freeze(['master', 'model', 'msdb', 'tempdb']);

const TECHNICAL_SCHEMA_NAMES = Object.freeze([
  'db_accessadmin',
  'db_backupoperator',
  'db_datareader',
  'db_datawriter',
  'db_ddladmin',
  'db_denydatareader',
  'db_denydatawriter',
  'db_owner',
  'db_securityadmin',
  'INFORMATION_SCHEMA',
  'sys',
]);

export class MsSqlQueryGeneratorInternal<Dialect extends MssqlDialect = MssqlDialect>
  extends AbstractQueryGeneratorInternal<Dialect> {

  getTechnicalDatabaseNames() {
    return TECHNICAL_DATABASE_NAMES;
  }

  getTechnicalSchemaNames() {
    return TECHNICAL_SCHEMA_NAMES;
  }

  addLimitAndOffset(options: AddLimitOffsetOptions) {
    let fragment = '';
    if (options.offset || options.limit) {
      fragment += ` OFFSET ${this.queryGenerator.escape(options.offset || 0, options)} ROWS`;
    }

    if (options.limit != null) {
      if (options.limit === 0) {
        throw new Error(`LIMIT 0 is not supported by ${this.dialect.name} dialect.`);
      }

      fragment += ` FETCH NEXT ${this.queryGenerator.escape(options.limit, options)} ROWS ONLY`;
    }

    return fragment;
  }

  getReturnFields(options: GetReturnFieldsOptions, modelAttributes: Map<string, AttributeOptions>): string[] {
    const returnFields: string[] = [];

    if (Array.isArray(options.returning)) {
      returnFields.push(...options.returning.map(field => {
        if (typeof field === 'string') {
          return this.queryGenerator.quoteIdentifier(field);
        } else if (field instanceof Literal) {
          // Due to how the mssql query is built, using a literal would never result in a properly formed query.
          // It's better to warn early.
          throw new Error(`literal() cannot be used in the "returning" option array in ${this.dialect.name}. Use col(), or a string instead.`);
        } else if (field instanceof Col) {
          return this.queryGenerator.formatSqlExpression(field);
        }

        throw new Error(`Unsupported value in "returning" option: ${inspect(field)}. This option only accepts true, false, or an array of strings, col() or literal().`);
      }));
    } else if (modelAttributes.size > 0) {
      const attributes = [...modelAttributes.entries()]
        .map(([name, attr]) => ({ ...attr, columnName: this.queryGenerator.quoteIdentifier(attr.columnName ?? name) }))
        .filter(({ type }) => !(type instanceof VIRTUAL))
        .map(({ columnName }) => columnName);

      returnFields.push(...attributes);
    }

    if (returnFields.length === 0) {
      returnFields.push('*');
    }

    return returnFields;
  }

  generateOutputTableFragment(returnFields: string[], modelAttributes: Map<string, AttributeOptions>): string {
    const attributes = returnFields
      .filter(field => field !== '*')
      .map(field => {
        const unquotedField = field.replace(this.dialect.TICK_CHAR_LEFT, '').replace(this.dialect.TICK_CHAR_RIGHT, '');

        return `${field} ${attributeTypeToSql(this.sequelize.normalizeDataType(modelAttributes.get(unquotedField)?.type ?? 'NVARCHAR(MAX)'))}`;
      });

    if (returnFields.includes('*')) {
      const modelAttributeFields = [...modelAttributes.entries()]
        .map(([name, attr]) => ({ ...attr, columnName: this.queryGenerator.quoteIdentifier(attr.columnName ?? name) }))
        .filter(({ columnName, type }) => !returnFields.includes(columnName) && !(type instanceof VIRTUAL))
        .map(({ columnName, type }) => `${columnName} ${attributeTypeToSql(this.sequelize.normalizeDataType(type))}`);

      attributes.push(...modelAttributeFields);
    }

    if (attributes.length === 0) {
      throw new Error('Cannot use "returning" option with no attributes');
    }

    return joinSQLFragments([
      'DECLARE @output_table TABLE (',
      attributes.join(', '),
      ')',
    ]);
  }
}
