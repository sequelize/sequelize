import type { TemporalTimeFindOptions } from '@sequelize/core';
import { TemporalTimeQueryType } from '@sequelize/core';
import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.internal-types.js';
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

  formatTemporalTime(options: TemporalTimeFindOptions) {
    if (options.type !== 'SYSTEM_TIME') {
      throw new Error(`Invalid temporal time type ${options.type}.`);
    }

    const temporalTimeQuery = 'FOR SYSTEM_TIME';
    if (options.period === TemporalTimeQueryType.ALL) {
      return `${temporalTimeQuery} ALL`;
    }

    if (!options.startDate) {
      throw new Error(`System time start date is required for ${options.type} query.`);
    }

    if (!(options.startDate instanceof Date)) {
      throw new TypeError('System time start date must be a Date object.');
    }

    const startDate = new Date(options.startDate.getTime()).toISOString();
    if (options.period === TemporalTimeQueryType.AS_OF) {
      return `${temporalTimeQuery} AS OF ${this.queryGenerator.escape(startDate)}`;
    }

    if (!options.endDate) {
      throw new Error(`System time end date is required for ${options.type} query.`);
    }

    if (!(options.endDate instanceof Date)) {
      throw new TypeError('System time end date must be a Date object.');
    }

    const endDate = new Date(options.endDate.getTime()).toISOString();
    switch (options.period || '') {
      case TemporalTimeQueryType.FROM_TO:
        return `${temporalTimeQuery} FROM ${this.queryGenerator.escape(startDate)} TO ${this.queryGenerator.escape(endDate)}`;
      case TemporalTimeQueryType.BETWEEN:
        return `${temporalTimeQuery} BETWEEN ${this.queryGenerator.escape(startDate)} AND ${this.queryGenerator.escape(endDate)}`;
      case TemporalTimeQueryType.CONTAINED_IN:
        return `${temporalTimeQuery} CONTAINED IN (${this.queryGenerator.escape(startDate)}, ${this.queryGenerator.escape(endDate)})`;
      default:
        throw new Error(`Invalid temporal time period ${options.period}.`);
    }
  }
}
