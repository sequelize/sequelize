import type { ModelDefinition } from '@sequelize/core';
import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type {
  AddLimitOffsetOptions,
  GetReturnFieldsOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
import { Attribute } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/attribute.js';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { Col } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/col.js';
import { join } from '@sequelize/utils';
import { inspect } from 'node:util';
import type { MsSqlDialect } from './dialect.js';

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

export class MsSqlQueryGeneratorInternal<
  Dialect extends MsSqlDialect = MsSqlDialect,
> extends AbstractQueryGeneratorInternal<Dialect> {
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

  formatReturnFields(
    options: GetReturnFieldsOptions,
    modelDefinition?: ModelDefinition | null,
  ): string[] {
    const returnFields = this.normalizeReturning(options, modelDefinition);

    return returnFields.map(field => {
      if (typeof field === 'string') {
        return this.queryGenerator.quoteIdentifier(field);
      } else if (field instanceof Attribute || field instanceof Col) {
        return this.queryGenerator.formatSqlExpression(field, {
          ...options,
          model: modelDefinition,
        });
      }

      throw new Error(
        `Unsupported value in "returning" option: ${inspect(field)}. This option only accepts true, false, an array of strings, attribute() or col() sql expressions.`,
      );
    });
  }

  generateOutputTableFragment(
    options: GetReturnFieldsOptions,
    modelDefinition: ModelDefinition,
  ): string {
    let hasStar = false;
    const returnFields = this.normalizeReturning(options, modelDefinition);
    const tableColumns = [];
    const columnsToExclude = new Set<string>();
    // Build the columns for the output table
    for (const field of returnFields) {
      if (field instanceof BaseSqlExpression) {
        // The output table needs to exclude the '*' option as it represents all columns
        if (
          field instanceof Col &&
          field.identifiers.length === 1 &&
          field.identifiers[0] === '*'
        ) {
          hasStar = true;
          continue;
        }

        tableColumns.push(
          `${this.queryGenerator.formatSqlExpression(field, { ...options, model: modelDefinition })} ${attributeTypeToSql('NVARCHAR(MAX)')}`,
        );
      } else {
        // We don't know if the field is a table column or a model attribute
        const columnName = modelDefinition.getColumnNameLoose(field);
        const attribute =
          modelDefinition.physicalAttributes.get(field) ?? modelDefinition.columns.get(columnName);
        columnsToExclude.add(columnName);
        tableColumns.push(
          `${this.queryGenerator.quoteIdentifier(columnName)} ${attributeTypeToSql(this.sequelize.normalizeDataType(attribute?.type ?? 'NVARCHAR(MAX)'))}`,
        );
      }
    }

    // If returning all columns, we need to add the additional columns from the model definition
    // that are not already included in the returning option
    if (hasStar) {
      for (const attribute of modelDefinition.physicalAttributes.values()) {
        if (columnsToExclude.has(attribute.columnName)) {
          continue;
        }

        tableColumns.push(
          `${this.queryGenerator.quoteIdentifier(attribute.columnName)} ${attributeTypeToSql(attribute.type)}`,
        );
      }
    }

    if (returnFields.length === 0) {
      throw new Error('Cannot use "returning" option with no attributes');
    }

    return `DECLARE @output_table TABLE (${join(tableColumns, ', ')})`;
  }
}
