import { EMPTY_ARRAY } from '@sequelize/utils';
import { Deferrable } from '../deferrable.js';
import type { AssociationPath } from '../expression-builders/association-path.js';
import type { Attribute } from '../expression-builders/attribute.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import type { Cast } from '../expression-builders/cast.js';
import type { Col } from '../expression-builders/col.js';
import type { DialectAwareFn } from '../expression-builders/dialect-aware-fn.js';
import type { Fn } from '../expression-builders/fn.js';
import type { JsonPath } from '../expression-builders/json-path.js';
import type { Literal } from '../expression-builders/literal.js';
import type { Sequelize } from '../sequelize.js';
import { extractModelDefinition } from '../utils/model-utils.js';
import { injectReplacements } from '../utils/sql.js';
import { attributeTypeToSql } from './data-types-utils.js';
import type { AbstractDialect } from './dialect.js';
import type { EscapeOptions } from './query-generator-typescript.js';
import type { AddLimitOffsetOptions } from './query-generator.internal-types.js';
import type { GetConstraintSnippetQueryOptions, TableOrModel } from './query-generator.types.js';
import { WhereSqlBuilder, wrapAmbiguousWhere } from './where-sql-builder.js';

export class AbstractQueryGeneratorInternal<Dialect extends AbstractDialect = AbstractDialect> {
  readonly dialect: Dialect;
  readonly whereSqlBuilder: WhereSqlBuilder;

  get sequelize(): Sequelize {
    return this.dialect.sequelize;
  }

  get queryGenerator(): Dialect['queryGenerator'] {
    return this.dialect.queryGenerator;
  }

  constructor(dialect: Dialect) {
    this.dialect = dialect;

    this.whereSqlBuilder = new WhereSqlBuilder(dialect);
  }

  getTechnicalDatabaseNames(): readonly string[] {
    return EMPTY_ARRAY;
  }

  getTechnicalSchemaNames(): readonly string[] {
    return EMPTY_ARRAY;
  }

  getConstraintSnippet(tableName: TableOrModel, options: GetConstraintSnippetQueryOptions) {
    const quotedFields = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.queryGenerator.quoteIdentifier(field);
      }

      if (field instanceof BaseSqlExpression) {
        return this.queryGenerator.formatSqlExpression(field);
      }

      if (field.attribute) {
        throw new Error(
          'The field.attribute property has been removed. Use the field.name property instead',
        );
      }

      if (!field.name) {
        throw new Error(`The following index field has no name: ${field}`);
      }

      return this.queryGenerator.quoteIdentifier(field.name);
    });

    const constraintNameParts = options.name
      ? null
      : options.fields.map(field => {
          if (typeof field === 'string') {
            return field;
          }

          if (field instanceof BaseSqlExpression) {
            throw new TypeError(
              `The constraint name must be provided explicitly if one of Sequelize's method (literal(), col(), etc…) is used in the constraint's fields`,
            );
          }

          return field.name;
        });

    let constraintSnippet;
    const table = this.queryGenerator.extractTableDetails(tableName);
    const fieldsSqlQuotedString = quotedFields.join(', ');
    const fieldsSqlString = constraintNameParts?.join('_');

    switch (options.type.toUpperCase()) {
      case 'CHECK': {
        if (!this.dialect.supports.constraints.check) {
          throw new Error(`Check constraints are not supported by ${this.dialect.name} dialect`);
        }

        const constraintName = this.queryGenerator.quoteIdentifier(
          options.name || `${table.tableName}_${fieldsSqlString}_ck`,
        );
        constraintSnippet = `CONSTRAINT ${constraintName} CHECK (${this.queryGenerator.whereItemsQuery(options.where)})`;
        break;
      }

      case 'UNIQUE': {
        if (!this.dialect.supports.constraints.unique) {
          throw new Error(`Unique constraints are not supported by ${this.dialect.name} dialect`);
        }

        const constraintName = this.queryGenerator.quoteIdentifier(
          options.name || `${table.tableName}_${fieldsSqlString}_uk`,
        );
        constraintSnippet = `CONSTRAINT ${constraintName} UNIQUE (${fieldsSqlQuotedString})`;
        if (options.deferrable) {
          constraintSnippet += ` ${this.getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      case 'DEFAULT': {
        if (!this.dialect.supports.constraints.default) {
          throw new Error(`Default constraints are not supported by ${this.dialect.name} dialect`);
        }

        if (options.defaultValue === undefined) {
          throw new Error('Default value must be specified for DEFAULT CONSTRAINT');
        }

        const constraintName = this.queryGenerator.quoteIdentifier(
          options.name || `${table.tableName}_${fieldsSqlString}_df`,
        );
        constraintSnippet = `CONSTRAINT ${constraintName} DEFAULT (${this.queryGenerator.escape(options.defaultValue, options)}) FOR ${quotedFields[0]}`;
        break;
      }

      case 'PRIMARY KEY': {
        if (!this.dialect.supports.constraints.primaryKey) {
          throw new Error(
            `Primary key constraints are not supported by ${this.dialect.name} dialect`,
          );
        }

        const constraintName = this.queryGenerator.quoteIdentifier(
          options.name || `${table.tableName}_${fieldsSqlString}_pk`,
        );
        constraintSnippet = `CONSTRAINT ${constraintName} PRIMARY KEY (${fieldsSqlQuotedString})`;
        if (options.deferrable) {
          constraintSnippet += ` ${this.getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      case 'FOREIGN KEY': {
        if (!this.dialect.supports.constraints.foreignKey) {
          throw new Error(
            `Foreign key constraints are not supported by ${this.dialect.name} dialect`,
          );
        }

        const references = options.references;
        if (!references || !references.table || !(references.field || references.fields)) {
          throw new Error(
            'Invalid foreign key constraint options. `references` object with `table` and `field` must be specified',
          );
        }

        const referencedTable = this.queryGenerator.extractTableDetails(references.table);
        const constraintName = this.queryGenerator.quoteIdentifier(
          options.name || `${table.tableName}_${fieldsSqlString}_${referencedTable.tableName}_fk`,
        );
        const quotedReferences =
          references.field !== undefined
            ? this.queryGenerator.quoteIdentifier(references.field)
            : references.fields!.map(f => this.queryGenerator.quoteIdentifier(f)).join(', ');
        const referencesSnippet = `${this.queryGenerator.quoteTable(referencedTable)} (${quotedReferences})`;
        constraintSnippet = `CONSTRAINT ${constraintName} `;
        constraintSnippet += `FOREIGN KEY (${fieldsSqlQuotedString}) REFERENCES ${referencesSnippet}`;
        if (options.onUpdate) {
          if (!this.dialect.supports.constraints.onUpdate) {
            throw new Error(
              `Foreign key constraint with onUpdate is not supported by ${this.dialect.name} dialect`,
            );
          }

          constraintSnippet += ` ON UPDATE ${options.onUpdate.toUpperCase()}`;
        }

        if (options.onDelete) {
          constraintSnippet += ` ON DELETE ${options.onDelete.toUpperCase()}`;
        }

        if (options.deferrable) {
          constraintSnippet += ` ${this.getDeferrableConstraintSnippet(options.deferrable)}`;
        }

        break;
      }

      default: {
        throw new Error(
          `Constraint type ${options.type} is not supported by ${this.dialect.name} dialect`,
        );
      }
    }

    return constraintSnippet;
  }

  getDeferrableConstraintSnippet(deferrable: Deferrable) {
    if (!this.dialect.supports.constraints.deferrable) {
      throw new Error(`Deferrable constraints are not supported by ${this.dialect.name} dialect`);
    }

    switch (deferrable) {
      case Deferrable.INITIALLY_DEFERRED: {
        return 'DEFERRABLE INITIALLY DEFERRED';
      }

      case Deferrable.INITIALLY_IMMEDIATE: {
        return 'DEFERRABLE INITIALLY IMMEDIATE';
      }

      case Deferrable.NOT: {
        return 'NOT DEFERRABLE';
      }

      default: {
        throw new Error(`Unknown constraint checking behavior ${deferrable}`);
      }
    }
  }

  formatAssociationPath(associationPath: AssociationPath): string {
    return `${this.queryGenerator.quoteIdentifier(associationPath.associationPath.join('->'))}.${this.queryGenerator.quoteIdentifier(associationPath.attributeName)}`;
  }

  formatJsonPath(jsonPathVal: JsonPath, options?: EscapeOptions): string {
    const value = this.queryGenerator.escape(jsonPathVal.expression, options);

    if (jsonPathVal.path.length === 0) {
      return value;
    }

    return this.queryGenerator.jsonPathExtractionQuery(value, jsonPathVal.path, false);
  }

  formatLiteral(piece: Literal, options?: EscapeOptions): string {
    const sql = piece.val
      .map(part => {
        if (part instanceof BaseSqlExpression) {
          return this.queryGenerator.formatSqlExpression(part, options);
        }

        return part;
      })
      .join('');

    if (options?.replacements) {
      return injectReplacements(sql, this.dialect, options.replacements, {
        onPositionalReplacement: () => {
          throw new TypeError(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal(${JSON.stringify(sql)})`);
        },
      });
    }

    return sql;
  }

  formatAttribute(piece: Attribute, options?: EscapeOptions): string {
    const modelDefinition = options?.model ? extractModelDefinition(options.model) : null;

    // This handles special attribute syntaxes like $association.references$, json.paths, and attribute::casting
    const columnName =
      modelDefinition?.getColumnNameLoose(piece.attributeName) ?? piece.attributeName;

    if (options?.mainAlias) {
      return `${this.queryGenerator.quoteIdentifier(options.mainAlias)}.${this.queryGenerator.quoteIdentifier(columnName)}`;
    }

    return this.queryGenerator.quoteIdentifier(columnName);
  }

  formatFn(piece: Fn, options?: EscapeOptions): string {
    // arguments of a function can be anything, it's not necessarily the type of the attribute,
    // so we need to remove the type from their escape options
    const argEscapeOptions =
      piece.args.length > 0 && options?.type ? { ...options, type: undefined } : options;
    const args = piece.args
      .map(arg => {
        return this.queryGenerator.escape(arg, argEscapeOptions);
      })
      .join(', ');

    return `${piece.fn}(${args})`;
  }

  formatDialectAwareFn(piece: DialectAwareFn, options?: EscapeOptions): string {
    // arguments of a function can be anything, it's not necessarily the type of the attribute,
    // so we need to remove the type from their escape options
    const argEscapeOptions =
      piece.args.length > 0 && options?.type ? { ...options, type: undefined } : options;

    if (!piece.supportsDialect(this.dialect)) {
      throw new Error(
        `Function ${piece.constructor.name} is not supported by ${this.dialect.name}.`,
      );
    }

    return piece.applyForDialect(this.dialect, argEscapeOptions);
  }

  formatCast(cast: Cast, options?: EscapeOptions) {
    const type = this.sequelize.normalizeDataType(cast.type);

    const castSql = wrapAmbiguousWhere(
      cast.expression,
      this.queryGenerator.escape(cast.expression, { ...options, type }),
    );
    const targetSql = attributeTypeToSql(type).toUpperCase();

    // TODO: if we're casting to the same SQL DataType, we could skip the SQL cast (but keep the JS cast)
    //  This is useful because sometimes you want to cast the Sequelize DataType to another Sequelize DataType,
    //  but they are both the same SQL type, so a SQL cast would be redundant.

    return `CAST(${castSql} AS ${targetSql})`;
  }

  formatCol(piece: Col, options?: EscapeOptions) {
    // TODO: can this be removed?
    if (piece.identifiers.length === 1 && piece.identifiers[0].startsWith('*')) {
      return '*';
    }

    // Weird legacy behavior
    const identifiers = piece.identifiers.length === 1 ? piece.identifiers[0] : piece.identifiers;

    // TODO: use quoteIdentifiers?
    // @ts-expect-error -- quote is declared on child class
    return this.queryGenerator.quote(identifiers, options?.model, undefined, options);
  }

  /**
   * Returns an SQL fragment for adding result constraints.
   *
   * @param _options
   */
  addLimitAndOffset(_options: AddLimitOffsetOptions): string {
    throw new Error(`addLimitAndOffset has not been implemented in ${this.dialect.name}.`);
  }
}
