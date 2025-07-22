'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const {
  beforeEach2,
  createSequelizeInstance,
  getSqliteDatabasePath,
  unlinkIfExists,
} = require('../../../support');

const dialect = Support.getTestDialect();
const dbFile = getSqliteDatabasePath('dao.sqlite');

describe('[SQLITE Specific] DAOFactory', () => {
  if (dialect !== 'sqlite3') {
    return;
  }

  function deleteTempFiles() {
    return unlinkIfExists(dbFile);
  }

  after(deleteTempFiles);

  const vars = beforeEach2(async () => {
    await deleteTempFiles();

    const sequelize = createSequelizeInstance({
      storage: dbFile,
    });

    const User = sequelize.define('User', {
      age: DataTypes.INTEGER,
      name: DataTypes.STRING,
      bio: DataTypes.TEXT,
    });
    await User.sync({ force: true });

    return { sequelize, User };
  });

  afterEach(() => {
    return vars.sequelize.close();
  });

  describe('STRICT tables', () => {
    it('should enforce type constraints when strict mode is enabled', async () => {
      const sequelize = createSequelizeInstance({
        storage: dbFile,
        dialectOptions: {
          strictTables: true, // Enable strict mode
        },
      });

      const StrictUser = sequelize.define('StrictUser', {
        age: DataTypes.INTEGER,
        name: DataTypes.STRING,
      });

      console.log('Creating StrictUser table with strict mode enabled');

      await StrictUser.sync({ force: true });

      // Valid data should work
      await StrictUser.create({ age: 21, name: 'John' });

      // Invalid data should fail
      try {
        await StrictUser.create({ age: 'twenty-one', name: 'John' });
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.name).to.equal('SequelizeDatabaseError');
        expect(error.message).to.match(/cannot store TEXT value in INTEGER column/);
      }

      await sequelize.close();
    });

    it('should allow non-strict behavior when disabled', async () => {
      const sequelize = createSequelizeInstance({
        storage: dbFile,
        dialectOptions: {
          strictTables: false, // Explicitly disable
        },
      });

      const LooseUser = sequelize.define('LooseUser', {
        age: DataTypes.INTEGER,
        name: DataTypes.STRING,
      });

      await LooseUser.sync({ force: true });

      // Should allow type conversion
      const user = await LooseUser.create({ age: '21', name: 'John' });
      expect(user.age).to.equal(21); // Note the type conversion

      await sequelize.close();
    });

    it('should include STRICT in CREATE TABLE statement', async () => {
      const sequelize = createSequelizeInstance({
        storage: dbFile,
        dialectOptions: {
          strictTables: true,
        },
        logging: sql => {
          if (sql.includes('CREATE TABLE')) {
            expect(sql).to.include('STRICT');
          }
        },
      });

      const User = sequelize.define('User', {
        name: DataTypes.STRING,
      });

      await User.sync({ force: true });
      await sequelize.close();
    });
  });
});
