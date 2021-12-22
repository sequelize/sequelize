'use strict';

const chai = require('chai'),
  expect = chai.expect,
  path = require('path'),
  Support = require(`${__dirname}/support`),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = Support.Sequelize,
  registerDialect = Support.Sequelize.registerDialect,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Sequelize'), () => {
  describe('dialectModule options', () => {
    it('options.dialectModule', () => {
      const dialectModule = {
        verbose: () => { return dialectModule; }
      };

      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModule
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
        default: throw Error('Unsupported dialect');
      }

      // this will throw if invalid path is passed
      new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModulePath: dialectPath
      });
    });

    it('options.dialectModulePath fails for invalid path', () => {
      expect(() => {
        new Sequelize('dbname', 'root', 'pass', {
          port: 999,
          dialect,
          dialectModulePath: '/foo/bar/baz'
        });
      }).to.throw('Unable to find dialect at /foo/bar/baz');
    });

    it('initialization fails for unsupported dalect', () => {
      registerDialect( {
        getDialectName: () => 'supportedDialect'
      });
      DataTypes.supportedDialect = DataTypes.mysql;

      expect(() => {
        new Sequelize('dbname', 'root', 'pass', {
          port: 999,
          dialect: 'unsupportedDialect'
        });
      }).to.throw('The dialect unsupportedDialect is not supported. Supported dialects: mysql, db2, mssql, sqlite, mariadb, postgres, snowflake, supportedDialect.');    
    });

    // NOTE: disable this test before we refactor data-types
    xit('initialization success for supported dalect', () => {
      registerDialect( {
        getDialectName: () => 'supportedDialect'
      });

      new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect: 'supportedDialect'
      });
    });
  });
});
