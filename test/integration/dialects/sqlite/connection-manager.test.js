'use strict';

const chai = require('chai');
const jetpack = require('fs-jetpack').cwd(__dirname);
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('sequelize/lib/data-types');

const fileName = `${Math.random()}_test.sqlite`;
const directoryName = `${Math.random()}_test_directory`;
const nestedFileName = jetpack.path(directoryName, 'subdirectory', 'test.sqlite');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] Connection Manager', () => {
    after(() => {
      jetpack.remove(fileName);
      jetpack.remove(directoryName);
    });

    it('close connection and remove journal and wal files', async function() {
      const sequelize = Support.createSequelizeInstance({
        storage: jetpack.path(fileName)
      });
      const User = sequelize.define('User', { username: DataTypes.STRING });

      await User.sync({ force: true });

      await sequelize.query('PRAGMA journal_mode = WAL');
      await User.create({ username: 'user1' });

      await sequelize.transaction(transaction => {
        return User.create({ username: 'user2' }, { transaction });
      });

      expect(jetpack.exists(fileName)).to.be.equal('file');
      expect(jetpack.exists(`${fileName}-shm`), 'shm file should exists').to.be.equal('file');
      expect(jetpack.exists(`${fileName}-wal`), 'wal file should exists').to.be.equal('file');

      // move wal file content to main database
      // so those files can be removed on connection close
      // https://www.sqlite.org/wal.html#ckpt
      await sequelize.query('PRAGMA wal_checkpoint');

      // wal, shm files exist after checkpoint
      expect(jetpack.exists(`${fileName}-shm`), 'shm file should exists').to.be.equal('file');
      expect(jetpack.exists(`${fileName}-wal`), 'wal file should exists').to.be.equal('file');

      await sequelize.close();
      expect(jetpack.exists(fileName)).to.be.equal('file');
      expect(jetpack.exists(`${fileName}-shm`), 'shm file exists').to.be.false;
      expect(jetpack.exists(`${fileName}-wal`), 'wal file exists').to.be.false;

      await this.sequelize.query('PRAGMA journal_mode = DELETE');
    });

    it('automatic path provision for `options.storage`', async () => {
      await Support.createSequelizeInstance({ storage: nestedFileName })
        .define('User', { username: DataTypes.STRING })
        .sync({ force: true });

      expect(jetpack.exists(nestedFileName)).to.be.equal('file');
    });
  });
}
