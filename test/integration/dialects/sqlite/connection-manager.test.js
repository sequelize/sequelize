'use strict';

const chai = require('chai');
const fs = require('fs');
const path = require('path');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('../../../../lib/data-types');

const fileName = `${Math.random()}_test.sqlite`;

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] Connection Manager', () => {
    after(() => {
      fs.unlinkSync(path.join(__dirname, fileName));
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
          expect(fs.existsSync(path.join(__dirname, fileName))).to.be.true;
          expect(fs.existsSync(path.join(__dirname, `${fileName}-shm`)), 'shm file should exists').to.be.true;
          expect(fs.existsSync(path.join(__dirname, `${fileName}-wal`)), 'wal file should exists').to.be.true;

          return sequelize.close();
        })
        .then(() => {
          expect(fs.existsSync(path.join(__dirname, fileName))).to.be.true;
          expect(fs.existsSync(path.join(__dirname, `${fileName}-shm`)), 'shm file exists').to.be.false;
          expect(fs.existsSync(path.join(__dirname, `${fileName}-wal`)), 'wal file exists').to.be.false;

          return this.sequelize.query('PRAGMA journal_mode = DELETE');
        });
    });
  });
}
