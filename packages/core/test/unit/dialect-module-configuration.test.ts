import { expect } from 'chai';
import { Sequelize } from '@sequelize/core';
import { getTestDialect, getTestDialectTeaser } from '../support';

const dialect = getTestDialect();

describe(getTestDialectTeaser('Sequelize'), () => {
  describe('dialectModule options', () => {
    it('options.dialectModule', () => {
      const dialectModule = {
        verbose: () => {
          return dialectModule;
        },
      };

      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModule,
      });
      // @ts-expect-error -- connectionManager.lib is private
      expect(sequelize.connectionManager.lib).to.equal(dialectModule);
    });

    it('options.dialectModulePath', () => {
      let dialectPath: string;
      switch (dialect) {
        case 'postgres':
          dialectPath = require.resolve('pg');
          break;
        case 'mysql':
          dialectPath = require.resolve('mysql2');
          break;
        case 'mariadb':
          dialectPath = require.resolve('mariadb');
          break;
        case 'db2':
          dialectPath = require.resolve('ibm_db');
          break;
        case 'mssql':
          dialectPath = require.resolve('tedious');
          break;
        case 'sqlite':
          dialectPath = require.resolve('sqlite3');
          break;
        case 'ibmi':
          dialectPath = require.resolve('odbc');
          break;
        case 'snowflake':
          dialectPath = require.resolve('snowflake-sdk');
          break;
        case 'cockroachdb':
          dialectPath = require.resolve('pg');
          break;
        default:
          throw new Error('Unsupported dialect');
      }

      // this will throw if invalid path is passed
      new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModulePath: dialectPath,
      });
    });

    it('options.dialectModulePath fails for invalid path', () => {
      expect(() => {
        new Sequelize('dbname', 'root', 'pass', {
          port: 999,
          dialect,
          dialectModulePath: '/foo/bar/baz',
        });
      }).to.throw('Unable to find dialect at /foo/bar/baz');
    });
  });
});
