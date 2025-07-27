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
}
