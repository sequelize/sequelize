'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('../../lib/data-types'),
  sequelize = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Custom Queries'), () => {

  function createModel() {
    return sequelize.define('Dummies', {
      name: {
        type: DataTypes.STRING
      }
    }, {
      tableName: 'dummies',
      timestamps: false
    });
  }

  function createTable() {
    return sequelize.sync({ force: true }).then(() => {
      let query = 'INSERT INTO dummies (id, name) VALUES(10, \'evil\');';

      if (dialect === 'mssql') {
        query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
      }

      return sequelize.query(query, {
        type: sequelize.QueryTypes.INSERT
      });
    });
  }

  describe('Interpolated replacementes', () => {

    it('can interpolate unnamed replacements', () => {
      const Model = createModel();

      return createTable().then(() => {
        let query = 'INSERT INTO dummies (id, name) VALUES(?, ?);';

        if (dialect === 'mssql') {
          query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT,
          replacements: [20, 'abc\'"\n\r\b\t\\\x1a']
        });
      }).then(() => {
        return sequelize.query('SELECT * FROM dummies WHERE name = ?;', {
          model: Model,
          type: sequelize.QueryTypes.SELECT,
          replacements: ['abc\'"\n\r\b\t\\\x1a']
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc\'"\n\r\b\t\\\x1a'
        });
      });
    });

    it('can interpolate named replacements', () => {
      const Model = createModel();

      return createTable().then(() => {
        let query = 'INSERT INTO dummies (id, name) VALUES(:id, :name);';

        if (dialect === 'mssql') {
          query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT,
          replacements: {
            id: 20,
            name: 'abc\'"\n\r\b\t\\\x1a'
          }
        });
      }).then(() => {
        return sequelize.query('SELECT * FROM dummies WHERE name = :name;', {
          model: Model,
          type: sequelize.QueryTypes.SELECT,
          replacements: {
            name: 'abc\'"\n\r\b\t\\\x1a'
          }
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc\'"\n\r\b\t\\\x1a'
        });
      });
    });

  });


  describe('Binded parameters', () => {

    it('can bind unnamed parameters', () => {
      const Model = createModel();

      return createTable().then(() => {
        let query = 'INSERT INTO dummies (id, name) VALUES($1, $2);';

        if (dialect === 'mssql') {
          query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT,
          bind: [20, 'abc\'"\n\r\b\t\\\x1a']
        });
      }).then(() => {
        return sequelize.query('SELECT * FROM dummies WHERE name = $1;', {
          model: Model,
          type: sequelize.QueryTypes.SELECT,
          bind: ['abc\'"\n\r\b\t\\\x1a']
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc\'"\n\r\b\t\\\x1a'
        });
      });
    });

    it('can bind named parameters', () => {
      const Model = createModel();

      return createTable().then(() => {
        let query = 'INSERT INTO dummies (id, name) VALUES($id, $name);';

        if (dialect === 'mssql') {
          query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT,
          bind: {
            id: 20,
            name: 'abc\'"\n\r\b\t\\\x1a'
          }
        });
      }).then(() => {
        return sequelize.query('SELECT * FROM dummies WHERE name = $name;', {
          model: Model,
          type: sequelize.QueryTypes.SELECT,
          bind: {
            name: 'abc\'"\n\r\b\t\\\x1a'
          }
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc\'"\n\r\b\t\\\x1a'
        });
      });
    });

    it('can escape $', () => {
      const Model = createModel();

      return createTable().then(() => {
        let query = 'INSERT INTO dummies (id, name) VALUES($id, \'abc$$\');';

        if (dialect === 'mssql') {
          query = `SET IDENTITY_INSERT dummies ON; ${query}; SET IDENTITY_INSERT dummies OFF;`;
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT,
          bind: {
            id: 20
          }
        });
      }).then(() => {
        return sequelize.query('SELECT * FROM dummies WHERE id = $id AND name = \'abc$$\';', {
          model: Model,
          type: sequelize.QueryTypes.SELECT,
          bind: {
            id: 20
          }
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc$'
        });
      });
    });

  });


  describe('Compositions', () => {

    it('can use compositions', () => {
      const Model = createModel();

      return createTable().then(() => {
        // Nested composition just for testing, otherwise it is unneeded
        let query = sequelize.composition('INSERT INTO dummies (id, name) ', sequelize.composition('VALUES(', sequelize.slot(20)), ', ', sequelize.slot('abc\'"\n\r\b\t\\\x1a'), ');');

        if (dialect === 'mssql') {
          query = sequelize.composition('SET IDENTITY_INSERT dummies ON; ', query, '; SET IDENTITY_INSERT dummies OFF;');
        }

        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT
        });
      }).then(() => {
        return sequelize.query(sequelize.composition('SELECT * FROM dummies WHERE name = ', sequelize.slot('abc\'"\n\r\b\t\\\x1a'), ';'), {
          model: Model,
          type: sequelize.QueryTypes.SELECT
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc\'"\n\r\b\t\\\x1a'
        });
      });
    });

    it('do not need to escape $', () => {
      const Model = createModel();

      return createTable().then(() => {
        // Nested composition just for testing, otherwise it is unneeded
        let query = sequelize.composition('INSERT INTO dummies (id, name) ', sequelize.composition('VALUES(', sequelize.slot(20)), ', \'abc$\');');

        if (dialect === 'mssql') {
          query = sequelize.composition('SET IDENTITY_INSERT dummies ON; ', query, '; SET IDENTITY_INSERT dummies OFF;');
        }
        
        return sequelize.query(query, {
          type: sequelize.QueryTypes.INSERT
        });
      }).then(() => {
        return sequelize.query(sequelize.composition('SELECT * FROM dummies WHERE id = ', sequelize.slot(20), ' AND name = \'abc$\';'), {
          model: Model,
          type: sequelize.QueryTypes.SELECT
        });
      }).then(instances => {
        expect(instances.length).to.equal(1);
        expect(instances[0].get({ plain: true })).to.deep.equal({
          id: 20,
          name: 'abc$'
        });
      });
    });

  });

});
