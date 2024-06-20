'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect === 'mariadb') {
  describe('[MariaDB Specific] DAOFactory', () => {
    describe('constructor', () => {
      it('handles extended attributes (unique)', function () {
        const User = this.sequelize.define(
          `User${Support.rand()}`,
          {
            username: { type: DataTypes.STRING, unique: true },
          },
          { timestamps: false },
        );

        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          // note: UNIQUE is not specified here because it is only specified if the option passed to attributesToSQL is
          //  'unique: true'.
          // Model.init normalizes the 'unique' to ensure a consistent index, and createTableQuery handles adding
          //  a named UNIQUE constraint
          username: 'VARCHAR(255)',
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        });
      });

      it('handles extended attributes (default)', function () {
        const User = this.sequelize.define(
          `User${Support.rand()}`,
          {
            username: { type: DataTypes.STRING, defaultValue: 'foo' },
          },
          { timestamps: false },
        );
        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          username: "VARCHAR(255) DEFAULT 'foo'",
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        });
      });

      it('handles extended attributes (null)', function () {
        const User = this.sequelize.define(
          `User${Support.rand()}`,
          {
            username: { type: DataTypes.STRING, allowNull: false },
          },
          { timestamps: false },
        );
        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          username: 'VARCHAR(255) NOT NULL',
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
        });
      });

      it('handles extended attributes (primaryKey)', function () {
        const User = this.sequelize.define(
          `User${Support.rand()}`,
          {
            username: { type: DataTypes.STRING, primaryKey: true },
          },
          { timestamps: false },
        );
        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          username: 'VARCHAR(255) PRIMARY KEY',
        });
      });

      it('adds timestamps', function () {
        const User1 = this.sequelize.define(`User${Support.rand()}`, {});
        const User2 = this.sequelize.define(`User${Support.rand()}`, {}, { timestamps: true });

        expect(this.sequelize.queryGenerator.attributesToSQL(User1.getAttributes())).to.deep.equal({
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
          updatedAt: 'DATETIME(6) NOT NULL',
          createdAt: 'DATETIME(6) NOT NULL',
        });
        expect(this.sequelize.queryGenerator.attributesToSQL(User2.getAttributes())).to.deep.equal({
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
          updatedAt: 'DATETIME(6) NOT NULL',
          createdAt: 'DATETIME(6) NOT NULL',
        });
      });

      it('adds deletedAt if paranoid', function () {
        const User = this.sequelize.define(`User${Support.rand()}`, {}, { paranoid: true });
        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
          deletedAt: 'DATETIME(6)',
          updatedAt: 'DATETIME(6) NOT NULL',
          createdAt: 'DATETIME(6) NOT NULL',
        });
      });

      it('underscores timestamps if underscored', function () {
        const User = this.sequelize.define(
          `User${Support.rand()}`,
          {},
          { paranoid: true, underscored: true },
        );
        expect(this.sequelize.queryGenerator.attributesToSQL(User.getAttributes())).to.deep.equal({
          id: 'INTEGER NOT NULL auto_increment PRIMARY KEY',
          deleted_at: 'DATETIME(6)',
          updated_at: 'DATETIME(6) NOT NULL',
          created_at: 'DATETIME(6) NOT NULL',
        });
      });

      it('omits text fields with defaultValues', function () {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: { type: DataTypes.TEXT, defaultValue: 'helloworld' },
        });
        expect(User.getAttributes().name.type.toString()).to.equal('TEXT');
      });

      it('omits blobs fields with defaultValues', function () {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: { type: DataTypes.STRING.BINARY, defaultValue: 'helloworld' },
        });
        expect(User.getAttributes().name.type.toString()).to.equal('VARCHAR(255) BINARY');
      });
    });

    describe('primaryKeys', () => {
      it('determines the correct primaryKeys', function () {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          foo: { type: DataTypes.STRING, primaryKey: true },
          bar: DataTypes.STRING,
        });
        expect(this.sequelize.queryGenerator.attributesToSQL(User.primaryKeys)).to.deep.equal({
          foo: 'VARCHAR(255) PRIMARY KEY',
        });
      });
    });
  });
}
