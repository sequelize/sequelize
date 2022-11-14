import { join } from 'node:path';
import { Sequelize } from '@sequelize/core';
import { expect } from 'chai';
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
      let dialectPath = join(process.cwd(), 'node_modules');

      switch (dialect) {
        case 'postgres':
          dialectPath = join(dialectPath, 'pg');
          break;
        case 'mysql':
          dialectPath = join(dialectPath, 'mysql2');
          break;
        case 'mariadb':
          dialectPath = join(dialectPath, 'mariadb');
          break;
        case 'db2':
          dialectPath = join(dialectPath, 'ibm_db');
          break;
        case 'mssql':
          dialectPath = join(dialectPath, 'tedious');
          break;
        case 'sqlite':
          dialectPath = join(dialectPath, 'sqlite3');
          break;
        case 'ibmi':
          dialectPath = join(dialectPath, 'odbc');
          break;
        case 'snowflake':
          dialectPath = join(dialectPath, 'snowflake-sdk');
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
