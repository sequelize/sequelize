'use strict';

const Support   = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator,
  _         = require('lodash');

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('createTable', () => {
    const FooUser = current.define('user', {
      mood: DataTypes.ENUM('happy', 'sad')
    }, {
      schema: 'foo',
      timestamps: false
    });

    describe('with enums', () => {
      it('references enum in the right schema #3171', () => {
        expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
          sqlite: 'CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `mood` TEXT);',
          postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));',
          mariadb: "CREATE TABLE IF NOT EXISTS `foo`.`users` (`id` INTEGER NOT NULL auto_increment , `mood` ENUM('happy', 'sad'), PRIMARY KEY (`id`)) ENGINE=InnoDB;",
          mysql: "CREATE TABLE IF NOT EXISTS `foo.users` (`id` INTEGER NOT NULL auto_increment , `mood` ENUM('happy', 'sad'), PRIMARY KEY (`id`)) ENGINE=InnoDB;",
          mssql: "IF OBJECT_ID('[foo].[users]', 'U') IS NULL CREATE TABLE [foo].[users] ([id] INTEGER NOT NULL IDENTITY(1,1) , [mood] VARCHAR(255) CHECK ([mood] IN(N'happy', N'sad')), PRIMARY KEY ([id]));"
        });
      });
    });

    describe('with references', () => {
      const BarUser = current.define('user', {
        timestamps: false
      }).schema('bar');

      const BarProject = current.define('project', {
        user_id: {
          type: DataTypes.INTEGER,
          references: { model: BarUser },
          onUpdate: 'CASCADE',
          onDelete: 'NO ACTION'
        }
      }, {
        timestamps: false
      }).schema('bar');

      BarProject.belongsTo(BarUser, { foreignKey: 'user_id' });

      it('references right schema when adding foreign key #9029', () => {
        expectsql(sql.createTableQuery(BarProject.getTableName(), sql.attributesToSQL(BarProject.rawAttributes), { }), {
          sqlite: 'CREATE TABLE IF NOT EXISTS `bar.projects` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `user_id` INTEGER REFERENCES `bar.users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE);',
          postgres: 'CREATE TABLE IF NOT EXISTS "bar"."projects" ("id"   SERIAL , "user_id" INTEGER REFERENCES "bar"."users" ("id") ON DELETE NO ACTION ON UPDATE CASCADE, PRIMARY KEY ("id"));',
          mariadb: 'CREATE TABLE IF NOT EXISTS `bar`.`projects` (`id` INTEGER NOT NULL auto_increment , `user_id` INTEGER, PRIMARY KEY (`id`), FOREIGN KEY (`user_id`) REFERENCES `bar`.`users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE) ENGINE=InnoDB;',
          mysql: 'CREATE TABLE IF NOT EXISTS `bar.projects` (`id` INTEGER NOT NULL auto_increment , `user_id` INTEGER, PRIMARY KEY (`id`), FOREIGN KEY (`user_id`) REFERENCES `bar.users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE) ENGINE=InnoDB;',
          mssql: 'IF OBJECT_ID(\'[bar].[projects]\', \'U\') IS NULL CREATE TABLE [bar].[projects] ([id] INTEGER NOT NULL IDENTITY(1,1) , [user_id] INTEGER NULL, PRIMARY KEY ([id]), FOREIGN KEY ([user_id]) REFERENCES [bar].[users] ([id]) ON DELETE NO ACTION);'
        });
      });
    });

    describe('with references on primary key', () => {
      const File = current.define('file', {}, { timestamps: false });
      const Image = current.define('image', {
        id: {
          primaryKey: true,
          autoIncrement: true,
          type: DataTypes.INTEGER,
          references: {
            model: File,
            key: 'id'
          }
        }
      }, {
        timestamps: false
      });

      it('references on primary key #9461', () => {
        expectsql(sql.createTableQuery(Image.getTableName(), sql.attributesToSQL(Image.rawAttributes), { }), {
          sqlite: 'CREATE TABLE IF NOT EXISTS `images` (`id` INTEGER PRIMARY KEY AUTOINCREMENT REFERENCES `files` (`id`));',
          postgres: 'CREATE TABLE IF NOT EXISTS "images" ("id"  SERIAL  REFERENCES "files" ("id"), PRIMARY KEY ("id"));',
          mariadb: 'CREATE TABLE IF NOT EXISTS `images` (`id` INTEGER auto_increment , PRIMARY KEY (`id`), FOREIGN KEY (`id`) REFERENCES `files` (`id`)) ENGINE=InnoDB;',
          mysql: 'CREATE TABLE IF NOT EXISTS `images` (`id` INTEGER auto_increment , PRIMARY KEY (`id`), FOREIGN KEY (`id`) REFERENCES `files` (`id`)) ENGINE=InnoDB;',
          mssql: 'IF OBJECT_ID(\'[images]\', \'U\') IS NULL CREATE TABLE [images] ([id] INTEGER IDENTITY(1,1) , PRIMARY KEY ([id]), FOREIGN KEY ([id]) REFERENCES [files] ([id]));'
        });
      });
    });

    if (current.dialect.name === 'postgres') {
      describe('IF NOT EXISTS version check', () => {
        const modifiedSQL = _.clone(sql);
        const createTableQueryModified = sql.createTableQuery.bind(modifiedSQL);
        it('it will not have IF NOT EXISTS for version 9.0 or below', () => {
          modifiedSQL.sequelize.options.databaseVersion = '9.0.0';
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
        it('it will have IF NOT EXISTS for version 9.1 or above', () => {
          modifiedSQL.sequelize.options.databaseVersion = '9.1.0';
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
        it('it will have IF NOT EXISTS for default version', () => {
          modifiedSQL.sequelize.options.databaseVersion = 0;
          expectsql(createTableQueryModified(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), { }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id"));'
          });
        });
      });

      describe('Attempt to use different lodash template settings', () => {
        before(() => {
          // make handlebars
          _.templateSettings.evaluate = /{{([\s\S]+?)}}/g;
          _.templateSettings.interpolate = /{{=([\s\S]+?)}}/g;
          _.templateSettings.escape = /{{-([\s\S]+?)}}/g;
        });

        after(() => {
          // reset
          const __ = require('lodash').runInContext();
          _.templateSettings.evaluate = __.templateSettings.evaluate;
          _.templateSettings.interpolate = __.templateSettings.interpolate;
          _.templateSettings.escape = __.templateSettings.escape;
        });

        it('it should be a okay!', () => {
          expectsql(sql.createTableQuery(FooUser.getTableName(), sql.attributesToSQL(FooUser.rawAttributes), {
            comment: 'This is a test of the lodash template settings.'
          }), {
            postgres: 'CREATE TABLE IF NOT EXISTS "foo"."users" ("id"   SERIAL , "mood" "foo"."enum_users_mood", PRIMARY KEY ("id")); COMMENT ON TABLE "foo"."users" IS \'This is a test of the lodash template settings.\';'
          });
        });
      });
    }
  });
});
