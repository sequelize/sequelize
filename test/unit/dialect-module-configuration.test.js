'use strict';

const chai = require('chai');

const expect = chai.expect;
const path = require('path');

const Support = require(`${__dirname}/support`);
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Sequelize'), () => {
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
      expect(sequelize.connectionManager.lib).to.equal(dialectModule);
    });

    it('options.dialectModulePath', () => {
      let dialectPath = path.join(process.cwd(), 'node_modules');

      switch (dialect) {
        case 'postgres': dialectPath = path.join(dialectPath, 'pg'); break;
        case 'mysql': dialectPath = path.join(dialectPath, 'mysql2'); break;
        case 'mariadb': dialectPath = path.join(dialectPath, 'mariadb'); break;
        case 'db2': dialectPath = path.join(dialectPath, 'ibm_db'); break;
        case 'mssql': dialectPath = path.join(dialectPath, 'tedious'); break;
        case 'sqlite': dialectPath = path.join(dialectPath, 'sqlite3'); break;
        case 'snowflake': dialectPath = path.join(dialectPath, 'snowflake-sdk'); break;
        default: throw new Error('Unsupported dialect');
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
