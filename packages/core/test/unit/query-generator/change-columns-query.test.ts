import type { Dialect, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Deferrable, Model } from '@sequelize/core';
import type { AbstractQueryGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { expect } from 'chai';
import omit from 'lodash/omit';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const queryGenerator: AbstractQueryGenerator = sequelize.queryInterface.queryGenerator;
const dialectName: Dialect = sequelize.dialect.name;

// Some dialects require specifying all options when altering a column
// These options are used to reduce the size of the generated SQL when testing only part of it.
const defaultOptions = dialectName === 'postgres' ? {} : {
  allowNull: true,
  defaultValue: null,
  autoIncrement: false,
  comment: null,
};

describe('QueryGenerator#changeColumnsQuery', () => {
  it('produces a query for changing a column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      // changes to the nullability of a column should not be present in these queries!
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `name` CHAR(100) DEFAULT NULL;',
    });
  });

  it('throws if no columns were provided', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {});
    }).to.throw('changeColumnsQuery requires at least one column to be provided');
  });

  it('supports passing a DataType instead of ColumnOptions (in dialects that support it)', () => {
    expectsql(() => queryGenerator.changeColumnsQuery('users', {
      name: DataTypes.INTEGER,
    }), {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE INTEGER;',
      'mariadb mysql': new Error(`In ${dialectName}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)

Table: \`users\`
Column: \`name\``),
    });
  });

  it('supports passing a string as the DataType', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        ...defaultOptions,
        type: 'VARCHAR(5)',
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(5);',
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `name` VARCHAR(5) DEFAULT NULL;',
    });
  });

  it('defaults the schema to the one used in Sequelize options', () => {
    const customSequelize = createSequelizeInstance({
      schema: 'custom_schema',
    });

    const sql = customSequelize.queryInterface.queryGenerator.changeColumnsQuery('users', {
      name: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."users" ALTER COLUMN "name" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `custom_schema`.`users` MODIFY `name` CHAR(100) DEFAULT NULL;',
    });
  });

  it('supports passing a Model class as the tableName', () => {
    class User extends Model {}

    User.init({
      name: DataTypes.STRING,
    }, { sequelize, tableName: 'custom_users', schema: 'custom_schema' });

    const sql = queryGenerator.changeColumnsQuery(User, {
      name: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100) DEFAULT NULL;',
    });
  });

  it('maps attribute names when using a Model class', () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare firstName: string;
    }

    User.init({
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name',
      },
    }, { sequelize });

    const sql = queryGenerator.changeColumnsQuery(User, {
      firstName: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "Users" ALTER COLUMN "first_name" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `Users` MODIFY `first_name` CHAR(100) DEFAULT NULL;',
    });
  });

  it('throws when modifying an attribute that has not been declared', () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare firstName: string;
    }

    User.init({
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name',
      },
    }, { sequelize });

    expect(() => queryGenerator.changeColumnsQuery(User, {
      first_name: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    })).to.throw(`changeColumnsQuery: Attribute first_name does not exist on model User.`);
  });

  it('supports passing a TableNameWithSchema as the tableName', () => {
    const sql = queryGenerator.changeColumnsQuery({
      schema: 'custom_schema',
      tableName: 'custom_users',
    }, {
      name: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100) DEFAULT NULL;',
    });
  });

  it('supports changing more than one column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
      lastName: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "lastName" TYPE CHAR(100);',
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `firstName` CHAR(100) DEFAULT NULL, MODIFY `lastName` CHAR(100) DEFAULT NULL;',
    });
  });

  it('supports using an ENUM as the DataType', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        ...defaultOptions,
        type: DataTypes.ENUM('A', 'B', 'C'),
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE TYPE "public"."tmp_enum_users_name" AS ENUM('A', 'B', 'C');
        ALTER TABLE "users" ALTER COLUMN "name" TYPE "public"."tmp_enum_users_name" USING ("name"::text::"public"."tmp_enum_users_name");
        DROP TYPE IF EXISTS "public"."enum_users_name";
        ALTER TYPE "public"."tmp_enum_users_name" RENAME TO "enum_users_name";
      `,
      'mariadb mysql': `ALTER TABLE \`users\` MODIFY \`name\` ENUM('A', 'B', 'C') DEFAULT NULL;`,
    });
  });

  it('scopes enums per schema', () => {
    const sql = queryGenerator.changeColumnsQuery({ tableName: 'users', schema: 'custom_schema' }, {
      name: {
        ...defaultOptions,
        type: DataTypes.ENUM('A', 'B', 'C'),
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE TYPE "custom_schema"."tmp_enum_users_name" AS ENUM('A', 'B', 'C');
        ALTER TABLE "custom_schema"."users" ALTER COLUMN "name" TYPE "custom_schema"."tmp_enum_users_name" USING ("name"::text::"custom_schema"."tmp_enum_users_name");
        DROP TYPE IF EXISTS "custom_schema"."enum_users_name";
        ALTER TYPE "custom_schema"."tmp_enum_users_name" RENAME TO "enum_users_name";
      `,
      'mariadb mysql': `ALTER TABLE \`custom_schema\`.\`users\` MODIFY \`name\` ENUM('A', 'B', 'C') DEFAULT NULL;`,
    });
  });

  it('supports changing all base options', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
        allowNull: false,
        comment: 'First name of the user',
        defaultValue: 'John',
        autoIncrement: false,
      },
      lastName: {
        type: DataTypes.CHAR(100),
        allowNull: true,
        defaultValue: null,
        comment: 'Last name of the user',
        autoIncrement: false,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users"
          ALTER COLUMN "firstName" TYPE CHAR(100),
          ALTER COLUMN "firstName" SET NOT NULL,
          ALTER COLUMN "firstName" SET DEFAULT 'John',
          ALTER COLUMN "lastName" TYPE CHAR(100),
          ALTER COLUMN "lastName" DROP NOT NULL,
          ALTER COLUMN "lastName" SET DEFAULT NULL;
        COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';
        COMMENT ON COLUMN "users"."lastName" IS 'Last name of the user';`,
      'mariadb mysql': `
        ALTER TABLE \`users\`
          MODIFY \`firstName\` CHAR(100) NOT NULL DEFAULT 'John' COMMENT 'First name of the user',
          MODIFY \`lastName\` CHAR(100) DEFAULT NULL COMMENT 'Last name of the user';`,
    });
  });

  it('supports changing the allowNull option only (in supported dialects)', () => {
    expectsql(() => {
      return queryGenerator.changeColumnsQuery('users', {
        firstName: {
          allowNull: false,
        },
        lastName: {
          allowNull: true,
        },
      });
    }, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL, ALTER COLUMN "lastName" DROP NOT NULL;',
      'mariadb mysql': new Error(`In ${dialectName}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)

Table: \`users\`
Column: \`firstName\``),
    });
  });

  it('supports changing the default value only (in supported dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        defaultValue: 'John',
      },
    });

    expectsql(sql, {
      default: `ALTER TABLE [users] ALTER COLUMN [firstName] SET DEFAULT 'John';`,
    });
  });

  it('supports dropping the default value only (in supported dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        dropDefaultValue: true,
      },
    });

    expectsql(sql, {
      default: `ALTER TABLE [users] ALTER COLUMN [firstName] DROP DEFAULT;`,
    });
  });

  it('throws if dropDefaultValue is used with defaultValue', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        firstName: {
          type: DataTypes.STRING,
          dropDefaultValue: true,
          defaultValue: 'John',
        },
      });
    }).to.throw('Cannot use both dropDefaultValue and defaultValue on the same column.');
  });

  it('supports dropping the default value if type is specified (in all dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        ...omit(defaultOptions, 'defaultValue'),
        type: DataTypes.CHAR(100),
        dropDefaultValue: true,
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "firstName" DROP DEFAULT;`,
      'mariadb mysql': `ALTER TABLE \`users\` MODIFY \`firstName\` CHAR(100);`,
    });
  });

  it('supports changing the comment only', () => {
    expectsql(() => {
      return queryGenerator.changeColumnsQuery('users', {
        firstName: {
          comment: 'First name of the user',
        },
      });
    }, {
      postgres: `COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';`,
      'mariadb mysql': new Error(`In ${dialectName}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)

Table: \`users\`
Column: \`firstName\``),
    });
  });

  // This test is added because previous versions of Sequelize
  // first generated the query then used regexes to attempt to modify it, which was completely broken because default values can include anything.
  it('does not break if the default value includes special tokens', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        ...defaultOptions,
        type: DataTypes.CHAR(100),
        defaultValue: 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT',
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "firstName" SET DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
      'mariadb mysql': `ALTER TABLE \`users\` MODIFY \`firstName\` CHAR(100) DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
    });
  });

  it('supports enabling autoIncrement without other options (in compatible dialects)', () => {
    expectsql(() => {
      return queryGenerator.changeColumnsQuery('users', {
        int: {
          autoIncrement: true,
        },
      });
    }, {
      postgres: `
        CREATE SEQUENCE IF NOT EXISTS "users_int_seq" OWNED BY "users"."int";
        ALTER TABLE "users" ALTER COLUMN "int" SET DEFAULT nextval('users_int_seq'::regclass);`,
      'mariadb mysql': new Error(`In ${dialectName}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)

Table: \`users\`
Column: \`int\``),
    });
  });

  it('supports disabling autoIncrement without other options (in compatible dialects)', () => {
    expectsql(() => {
      return queryGenerator.changeColumnsQuery('users', {
        int: {
          autoIncrement: false,
        },
      });
    }, {
      postgres: `
        ALTER TABLE "users" ALTER COLUMN "int" DROP DEFAULT;`,
      'mariadb mysql': new Error(`In ${dialectName}, changeColumnsQuery uses CHANGE COLUMN, which requires specifying the complete column definition.
To prevent unintended changes to the properties of the column, we require that if one of the following properties is specified (set to a non-undefined value):
> type, allowNull, autoIncrement, comment
Then all of the following properties must be specified too (set to a non-undefined value):
> type, allowNull, autoIncrement, comment, defaultValue (or set dropDefaultValue to true)

Table: \`users\`
Column: \`int\``),
    });
  });

  it('supports disabling autoIncrement and setting a new default value', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        ...defaultOptions,
        type: DataTypes.INTEGER,
        autoIncrement: false,
        defaultValue: 14,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users" ALTER COLUMN "int" TYPE INTEGER, ALTER COLUMN "int" SET DEFAULT 14;`,
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `int` INTEGER DEFAULT 14;',
    });
  });

  it(`supports enabling autoIncrement with 'type' specified (in all dialects)`, () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        ...defaultOptions,
        type: DataTypes.INTEGER,
        autoIncrement: true,
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE SEQUENCE IF NOT EXISTS "users_int_seq" OWNED BY "users"."int";
        ALTER TABLE "users"
          ALTER COLUMN "int" TYPE INTEGER,
          ALTER COLUMN "int" SET DEFAULT nextval('users_int_seq'::regclass);`,
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `int` INTEGER AUTO_INCREMENT DEFAULT NULL;',
    });
  });

  it(`supports disabling autoIncrement with 'type' specified (in all dialects)`, () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        ...defaultOptions,
        type: DataTypes.INTEGER,
        autoIncrement: false,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users"
          ALTER COLUMN "int" TYPE INTEGER,
          ALTER COLUMN "int" DROP DEFAULT;`,
      'mariadb mysql': 'ALTER TABLE `users` MODIFY `int` INTEGER DEFAULT NULL;',
    });
  });

  it('supports enabling autoIncrementIdentity (postgres)', () => {
    expectsql(() => {
      return queryGenerator.changeColumnsQuery('users', {
        int: {
          autoIncrementIdentity: true,
          allowNull: false,
        },
      });
    }, {
      // nullability must be changed first, because 'generated by default as identity' is not allowed on nullable columns
      postgres: `ALTER TABLE "users" ALTER COLUMN "int" SET NOT NULL, ALTER COLUMN "int" ADD GENERATED BY DEFAULT AS IDENTITY;`,
      'mariadb mysql': new Error(`${dialectName} does not support autoIncrementIdentity`),
    });
  });

  it('rejects adding a primary key', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        id: {
          // @ts-expect-error -- we're testing the error in case someone without typescript tries to do this
          primaryKey: true,
        },
      });
    }).to.throw(Error, 'changeColumnsQuery does not support adding or removing a column from the primary key because it would need to drop and recreate the constraint but it does not know whether other columns are already part of the primary key. Use dropConstraint and addConstraint instead.');
  });

  it('rejects adding a named unique', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        id: {
          // @ts-expect-error -- we're testing the error in case someone without typescript tries to do this
          unique: 'my-unique-name',
        },
      });
    }).to.throw(Error, 'changeColumnsQuery does not support adding or removing a column from a unique index because it would need to drop and recreate the index but it does not know whether other columns are already part of the index. Use dropIndex and addIndex instead.');
  });

  it('rejects removing a unique', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        id: {
          // @ts-expect-error -- we're testing the error in case someone without typescript tries to do this
          unique: false,
        },
      });
    }).to.throw(Error, 'changeColumnsQuery does not support adding or removing a column from a unique index because it would need to drop and recreate the index but it does not know whether other columns are already part of the index. Use dropIndex and addIndex instead.');
  });

  it('supports marking a column as unique if it is the only column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      id: {
        unique: true,
      },
    });

    expectsql(sql, {
      default: 'ALTER TABLE [users] ADD CONSTRAINT [users_id_unique] UNIQUE ([id]);',
    });
  });

  it('supports adding a foreign key', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      otherKey: {
        references: {
          model: 'projects',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
    });

    expectsql(sql, {
      default: `ALTER TABLE [users] ADD FOREIGN KEY ([otherKey]) REFERENCES [projects]([id]) ON UPDATE CASCADE ON DELETE CASCADE;`,
    });
  });

  it('supports models in references', () => {
    class Project extends Model {}

    Project.init({}, { sequelize, tableName: 'projects' });

    const sql = queryGenerator.changeColumnsQuery('users', {
      otherKey: {
        references: {
          model: Project,
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    });

    expectsql(sql, {
      default: `ALTER TABLE [users] ADD FOREIGN KEY ([otherKey]) REFERENCES [projects]([id]) ON DELETE CASCADE;`,
    });
  });

  it('supports schemas in references', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      otherKey: {
        references: {
          model: { tableName: 'projects', schema: 'other_schema' },
          key: 'id',
        },
      },
    });

    expectsql(sql, {
      default: `ALTER TABLE [users] ADD FOREIGN KEY ([otherKey]) REFERENCES [other_schema].[projects]([id]);`,
    });
  });

  it('supports deferrable classes & instances', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      projectId: {
        references: {
          model: { tableName: 'projects' },
          key: 'id',
          // class
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
      groupId: {
        references: {
          model: { tableName: 'groups' },
          key: 'id',
          // instance
          deferrable: new Deferrable.INITIALLY_DEFERRED(),
        },
      },
    });

    expectsql(sql, {
      default: `
        ALTER TABLE [users]
          ADD FOREIGN KEY ([projectId]) REFERENCES [projects]([id]) DEFERRABLE INITIALLY IMMEDIATE,
          ADD FOREIGN KEY ([groupId]) REFERENCES [groups]([id]) DEFERRABLE INITIALLY DEFERRED;`,
    });
  });

  it('rejects specifying onUpdate or onDelete without references', () => {
    const error = 'changeColumnsQuery does not support changing onUpdate or onDelete on their own. Use dropConstraint and addConstraint instead.';

    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        id: {
          onUpdate: 'CASCADE',
        },
      });
    }).to.throw(error);

    expect(() => {
      queryGenerator.changeColumnsQuery('users', {
        id: {
          onDelete: 'CASCADE',
        },
      });
    }).to.throw(error);
  });
});
