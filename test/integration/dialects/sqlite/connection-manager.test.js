'use strict';

const chai = require('chai');
const jetpack = require('fs-jetpack');
const path = require('path');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('../../../../lib/data-types');

const fileName = `${Math.random()}_test.sqlite`;
const folderName = `${Math.random()}_test_folder`;

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] Connection Manager', () => {
    after(() => {
      jetpack.remove(path.join(__dirname, fileName));
      jetpack.remove(path.join(__dirname, folderName));
    });

    it('close connection and remove journal and wal files', function() {
      const sequelize = Support.createSequelizeInstance({
        storage: path.join(__dirname, fileName)
      });
      const User = sequelize.define('User', { username: DataTypes.STRING });

      return User
        .sync({ force: true })
        .then(() => sequelize.query('PRAGMA journal_mode = WAL'))
        .then(() => User.create({ username: 'user1' }))
        .then(() => {
          return sequelize.transaction(transaction => {
            return User.create({ username: 'user2' }, { transaction });
          });
        })
        .then(() => {
          expect(jetpack.exists(path.join(__dirname, fileName))).to.be.equal('file');
          expect(jetpack.exists(path.join(__dirname, `${fileName}-shm`)), 'shm file should exists').to.be.equal('file');
          expect(jetpack.exists(path.join(__dirname, `${fileName}-wal`)), 'wal file should exists').to.be.equal('file');

          return sequelize.close();
        })
        .then(() => {
          expect(jetpack.exists(path.join(__dirname, fileName))).to.be.equal('file');
          expect(jetpack.exists(path.join(__dirname, `${fileName}-shm`)), 'shm file exists').to.be.false;
          expect(jetpack.exists(path.join(__dirname, `${fileName}-wal`)), 'wal file exists').to.be.false;

          return this.sequelize.query('PRAGMA journal_mode = DELETE');
        });
    });

    it('automatic path provision for `options.storage`', () => {
      Support.createSequelizeInstance({
        storage: path.join(__dirname, folderName, fileName)
      })
        .define('User', { username: DataTypes.STRING })
        .sync({ force: true }).then(() => {
          expect(jetpack.exists(path.join(__dirname, folderName, fileName))).to.be.equal('file');
        });
    });
  });
}
