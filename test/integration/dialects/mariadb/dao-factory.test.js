'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect !== 'mariadb') return;
describe('[MariaDB Specific] DAOFactory', () => {
  describe('constructor', () => {
    it('handles extended attributes (unique)', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        username: { type: DataTypes.STRING, unique: true }
      }, { timestamps: false });

      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal({
        username: 'VARCHAR(255) UNIQUE',
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'
      });
    });

    it('handles extended attributes (default)', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        username: { type: DataTypes.STRING, defaultValue: 'foo' }
      }, { timestamps: false });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal({
        username: 'VARCHAR(255) DEFAULT \'foo\'',
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'
      });
    });

    it('handles extended attributes (null)', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        username: { type: DataTypes.STRING, allowNull: false }
      }, { timestamps: false });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal({
        username: 'VARCHAR(255) NOT NULL',
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'
      });
    });

    it('handles extended attributes (primaryKey)', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        username: { type: DataTypes.STRING, primaryKey: true }
      }, { timestamps: false });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal(
        { username: 'VARCHAR(255) PRIMARY KEY' });
    });

    it('adds timestamps', function() {
      const User1 = this.sequelize.define(`User${Support.rand()}`, {});
      const User2 = this.sequelize.define(`User${Support.rand()}`, {},
        { timestamps: true });

      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User1.rawAttributes)).to.deep.equal({
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        updatedAt: 'DATETIME NOT NULL',
        createdAt: 'DATETIME NOT NULL'
      });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User2.rawAttributes)).to.deep.equal({
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        updatedAt: 'DATETIME NOT NULL',
        createdAt: 'DATETIME NOT NULL'
      });
    });

    it('adds deletedAt if paranoid', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {},
        { paranoid: true });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal({
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        deletedAt: 'DATETIME',
        updatedAt: 'DATETIME NOT NULL',
        createdAt: 'DATETIME NOT NULL'
      });
    });

    it('underscores timestamps if underscored', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {},
        { paranoid: true, underscored: true });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.rawAttributes)).to.deep.equal({
        id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        deleted_at: 'DATETIME',
        updated_at: 'DATETIME NOT NULL',
        created_at: 'DATETIME NOT NULL'
      });
    });

    it('omits text fields with defaultValues', function() {
      const User = this.sequelize.define(`User${Support.rand()}`,
        { name: { type: DataTypes.TEXT, defaultValue: 'helloworld' } });
      expect(User.rawAttributes.name.type.toString()).to.equal('TEXT');
    });

    it('omits blobs fields with defaultValues', function() {
      const User = this.sequelize.define(`User${Support.rand()}`,
        { name: { type: DataTypes.STRING.BINARY, defaultValue: 'helloworld' } });
      expect(User.rawAttributes.name.type.toString()).to.equal(
        'VARCHAR(255) BINARY');
    });
  });

  describe('primaryKeys', () => {
    it('determines the correct primaryKeys', function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        foo: { type: DataTypes.STRING, primaryKey: true },
        bar: DataTypes.STRING
      });
      expect(
        this.sequelize.getQueryInterface().queryGenerator.attributesToSQL(
          User.primaryKeys)).to.deep.equal(
        { 'foo': 'VARCHAR(255) PRIMARY KEY' });
    });
  });
});

