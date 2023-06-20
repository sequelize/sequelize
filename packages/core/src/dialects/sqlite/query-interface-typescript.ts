import { UnknownConstraintError } from '../../errors';
import { QueryTypes } from '../../query-types';
import type { Sequelize } from '../../sequelize';
import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type {
  AddConstraintOptions,
  ConstraintDescription,
  RemoveConstraintOptions,
  ShowConstraintsOptions,
} from '../abstract/query-interface.types';
import type { SqliteQueryGenerator } from './query-generator';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryInterfaceTypeScript extends AbstractQueryInterface {
  readonly sequelize: Sequelize;
  readonly queryGenerator: SqliteQueryGenerator;

  constructor(sequelize: Sequelize, queryGenerator: SqliteQueryGenerator) {
    super(sequelize, queryGenerator);
    this.sequelize = sequelize;
    this.queryGenerator = queryGenerator;
  }

  async addConstraint(tableName: TableNameOrModel, options: AddConstraintOptions): Promise<void> {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    const constraintOptions = { ...options };
    const constraintSnippet = this.queryGenerator.getConstraintSnippet(tableName, constraintOptions);
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    let createTableSql = describeCreateTable[0].sql as string;
    // Replace double quotes with backticks and ending ')' with constraint snippet
    createTableSql = createTableSql.replaceAll('"', '`').replace(/\);?$/, `, ${constraintSnippet});`);

    const fields = await this.describeTable(tableName, options);
    const sql = this.queryGenerator._replaceTableQuery(tableName, fields, createTableSql);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      // eslint-disable-next-line no-await-in-loop
      await this.sequelize.queryRaw(`${subQuery};`, { ...options, raw: true });
    }
  }

  async removeConstraint(
    tableName: TableNameOrModel,
    constraintName: string,
    options?: RemoveConstraintOptions,
  ): Promise<void> {
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    const createTableSql = describeCreateTable[0].sql as string;
    const constraints = await this.showConstraints(tableName, options);
    const constraint = constraints.find(c => c.constraintName === constraintName);

    if (!constraint) {
      const table = this.queryGenerator.extractTableDetails(tableName);
      throw new UnknownConstraintError({
        message: `Constraint ${constraintName} on table ${table.tableName} does not exist`,
        constraint: constraintName,
        table: table.tableName,
      });
    }

    constraint.constraintName = this.queryGenerator.quoteIdentifier(constraint.constraintName);
    let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.definition}`;

    if (constraint.constraintType === 'FOREIGN KEY') {
      constraintSnippet = `, CONSTRAINT ${constraint.constraintName} FOREIGN KEY`;
      const columns = constraint.columnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName)).join(', ');
      const referenceTableName = this.queryGenerator.quoteTable(constraint.referencedTableName!);
      const referenceTableColumns = constraint.referencedColumnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName)).join(', ');
      constraintSnippet += ` (${columns})`;
      constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableColumns})`;
      constraintSnippet += constraint.updateAction ? ` ON UPDATE ${constraint.updateAction}` : '';
      constraintSnippet += constraint.deleteAction ? ` ON DELETE ${constraint.deleteAction}` : '';
    } else if (constraint.constraintType === 'PRIMARY KEY') {
      constraintSnippet = `, CONSTRAINT ${constraint.constraintName} PRIMARY KEY`;
      const columns = constraint.columnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName)).join(', ');
      constraintSnippet += ` (${columns})`;
    }

    const fields = await this.describeTable(tableName, options);
    // Replace double quotes with backticks and remove constraint snippet
    const sql = this.queryGenerator._replaceTableQuery(tableName, fields, `${createTableSql.replaceAll('"', '`').replace(constraintSnippet, '')};`);
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      // eslint-disable-next-line no-await-in-loop
      await this.sequelize.queryRaw(`${subQuery};`, { ...options, raw: true });
    }
  }

  async showConstraints(tableName: TableNameOrModel, options?: ShowConstraintsOptions): Promise<ConstraintDescription[]> {
    const constraints = await super.showConstraints(tableName, options);

    if (options?.constraintName) {
      return constraints.filter(constraint => constraint.constraintName === options.constraintName);
    }

    return constraints;
  }
}
