import { UnknownConstraintError } from '../../errors';
import { QueryTypes } from '../../query-types';
import type { Sequelize } from '../../sequelize';
import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import { AbstractQueryInterface } from '../abstract/query-interface';
import type {
  AddConstraintOptions,
  ConstraintDescription,
  ConstraintType,
  QiDropAllTablesOptions,
  RemoveConstraintOptions,
  ShowConstraintsOptions,
} from '../abstract/query-interface.types';
import type { SqliteQueryGenerator } from './query-generator';
import { withSqliteForeignKeysOff } from './sqlite-utils';

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

  /**
   * Drop all tables
   *
   * @param options
   */
  async dropAllTables(options?: QiDropAllTablesOptions): Promise<void> {
    const skip = options?.skip || [];
    const allTables = await this.showAllTables(options);
    const tableNames = allTables.filter(tableName => !skip.includes(tableName.tableName));

    await withSqliteForeignKeysOff(this.sequelize, options, async () => {
      await Promise.all(tableNames.map(async tableName => this.dropTable(tableName, options)));
    });
  }

  async addConstraint(tableName: TableNameOrModel, options: AddConstraintOptions): Promise<void> {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    const constraintOptions = { ...options };
    const constraintSnippet = this.queryGenerator._getConstraintSnippet(tableName, constraintOptions);
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    let { sql: createTableSql } = describeCreateTable[0] as { sql: string };
    // Replace double quotes with backticks and ending ')' with constraint snippet
    createTableSql = createTableSql.replaceAll('"', '`').replace(/\);?$/, `, ${constraintSnippet})`);

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

    const { sql: createTableSql } = describeCreateTable[0] as { sql: string };
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
    } else if (['PRIMARY KEY', 'UNIQUE'].includes(constraint.constraintType)) {
      constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType}`;
      const columns = constraint.columnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName)).join(', ');
      constraintSnippet += ` (${columns})`;
    }

    const fields = await this.describeTable(tableName, options);
    // Replace double quotes with backticks and remove constraint snippet
    const sql = this.queryGenerator._replaceTableQuery(tableName, fields, createTableSql.replaceAll('"', '`').replace(constraintSnippet, ''));
    const subQueries = sql.split(';').filter(q => q !== '');

    for (const subQuery of subQueries) {
      // eslint-disable-next-line no-await-in-loop
      await this.sequelize.queryRaw(`${subQuery};`, { ...options, raw: true });
    }
  }

  async showConstraints(tableName: TableNameOrModel, options?: ShowConstraintsOptions): Promise<ConstraintDescription[]> {
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    const { sql: createTableSql } = describeCreateTable[0] as { sql: string };
    const match = /CREATE TABLE (?:`|'|")(\S+)(?:`|'|") \((.+)\)/.exec(createTableSql);
    const data: ConstraintDescription[] = [];

    if (match) {
      const [, constraintTableName, attributeSQL] = match;
      const keys = [];
      const attributes = [];
      const constraints = [];
      const sqlAttributes = attributeSQL.split(/,(?![^(]*\))/).map(attr => attr.trim());
      for (const attribute of sqlAttributes) {
        if (attribute.startsWith('CONSTRAINT')) {
          constraints.push(attribute);
        } else if (attribute.startsWith('PRIMARY KEY') || attribute.startsWith('FOREIGN KEY')) {
          keys.push(attribute);
        } else {
          attributes.push(attribute);
        }
      }

      for (const attribute of attributes) {
        const [, column, type] = attribute.match(/`(\S+)` (.+)/) || [];
        if (/\bPRIMARY KEY\b/.test(type)) {
          data.push({
            constraintSchema: '',
            constraintName: 'PRIMARY',
            constraintType: 'PRIMARY KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
          });
        } else if (/\bREFERENCES\b/.test(type)) {
          const deleteAction = type.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = type.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, referencedTableName, referencedColumnNames] = type.match(/REFERENCES `(\S+)` \(`(\S+)`\)/) || [];

          data.push({
            constraintSchema: '',
            constraintName: 'FOREIGN',
            constraintType: 'FOREIGN KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
            referencedTableSchema: '',
            referencedTableName: referencedTableName ?? '',
            referencedColumnNames: [referencedColumnNames],
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        } else if (/\bUNIQUE\b/.test(type)) {
          data.push({
            constraintSchema: '',
            constraintName: 'UNIQUE',
            constraintType: 'UNIQUE',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
          });
        } else if (/\bCHECK\b/.test(type)) {
          const definition = type.match(/CHECK (.+)/);

          data.push({
            constraintSchema: '',
            constraintName: 'CHECK',
            constraintType: 'CHECK',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
            definition: definition ? definition[1] ?? '' : '',
          });
        }
      }

      for (const constraint of constraints) {
        const [, constraintName, constraintType, definition] = constraint.match(/CONSTRAINT (?:`|'|")(\S+)(?:`|'|") (\w+(?: \w+)?) (.+)/) || [];
        if (/\bPRIMARY KEY\b/.test(constraint)) {
          const columnsMatch = [...definition.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: 'PRIMARY KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: columnsMatch.map(col => col[1]),
          });
        } else if (/\bREFERENCES\b/.test(constraint)) {
          const deleteAction = definition.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = definition.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, rawColumnNames, referencedTableName, rawReferencedColumnNames] = definition.match(/\(([^\s,]+(?:,\s?[^\s,]+)*)\) REFERENCES `(\S+)` \(([^\s,]+(?:,\s?[^\s,]+)*)\)/) || [];
          const columnsMatch = [...rawColumnNames.matchAll(/`(\S+)`/g)];
          const referencedColumnNames = [...rawReferencedColumnNames.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: 'FOREIGN KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: columnsMatch.map(col => col[1]),
            referencedTableSchema: '',
            referencedTableName: referencedTableName ?? '',
            referencedColumnNames: referencedColumnNames.map(col => col[1]),
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        } else if (['CHECK', 'DEFAULT', 'UNIQUE'].includes(constraintType)) {
          const columnsMatch = [...definition.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: constraintType as ConstraintType,
            tableSchema: '',
            tableName: constraintTableName,
            ...constraintType !== 'CHECK' && { columnNames: columnsMatch.map(col => col[1]) },
            ...constraintType !== 'UNIQUE' && { definition },
          });
        }
      }

      for (const key of keys) {
        const [, constraintType, rawColumnNames] = key.match(/(\w+(?: \w+)?)\s?\(([^\s,]+(?:,\s?[^\s,]+)*)\)/) || [];
        const columnsMatch = [...rawColumnNames.matchAll(/`(\S+)`/g)];
        const columnNames = columnsMatch.map(col => col[1]);

        if (constraintType === 'PRIMARY KEY') {
          data.push({
            constraintSchema: '',
            constraintName: 'PRIMARY',
            constraintType,
            tableSchema: '',
            tableName: constraintTableName,
            columnNames,
          });
        } else if (constraintType === 'FOREIGN KEY') {
          const deleteAction = key.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = key.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, referencedTableName, rawReferencedColumnNames] = key.match(/REFERENCES `(\S+)` \(([^\s,]+(?:,\s?[^\s,]+)*)\)/) || [];
          const referencedColumnNames = [...rawReferencedColumnNames.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName: 'FOREIGN',
            constraintType,
            tableSchema: '',
            tableName: constraintTableName,
            columnNames,
            referencedTableSchema: '',
            referencedTableName,
            referencedColumnNames: referencedColumnNames.map(col => col[1]),
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        }
      }
    } else {
      throw new Error(`Could not parse constraints from SQL: ${createTableSql}`);
    }

    let constraintData = data;

    if (options?.columnName) {
      constraintData = constraintData.filter(constraint => constraint.columnNames?.includes(options.columnName!));
      constraintData = constraintData.map(constraint => {
        if (constraint.columnNames) {
          constraint.columnNames = constraint.columnNames.filter(column => column === options.columnName);
        }

        return constraint;
      });
    }

    if (options?.constraintName) {
      constraintData = constraintData.filter(constraint => constraint.constraintName === options.constraintName);
    }

    if (options?.constraintType) {
      constraintData = constraintData.filter(constraint => constraint.constraintType === options.constraintType);
    }

    return constraintData;
  }
}
