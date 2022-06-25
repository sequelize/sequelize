import { DataTypes, Model } from '@sequelize/core';
import type { AbstractQueryGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator';
import { expect } from 'chai';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const queryGenerator: AbstractQueryGenerator = sequelize.queryInterface.queryGenerator;

describe('QueryGenerator#changeColumnsQuery', () => {
  it('produces a query for changing a column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        type: DataTypes.CHAR(100),
      },
    });

    expectsql(sql, {
      // changes to the nullability of a column should not be present in these queries!
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `users` MODIFY `name` CHAR(100);',
    });
  });

  it('throws if no columns were provided', () => {
    expect(() => {
      queryGenerator.changeColumnsQuery('users', {});
    }).to.throw('changeColumnsQuery requires at least one column to be provided');
  });

  it('supports passing a DataType instead of ColumnOptions', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: DataTypes.INTEGER,
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE INTEGER;',
      mysql: 'ALTER TABLE `users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a string as the DataType', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        type: 'VARCHAR(5)',
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(5);',
      mysql: 'ALTER TABLE `users` MODIFY `name` VARCHAR(5);',
    });
  });

  it('defaults the schema to the one used in Sequelize options', () => {
    const customSequelize = createSequelizeInstance({
      schema: 'custom_schema',
    });

    const sql = customSequelize.queryInterface.queryGenerator.changeColumnsQuery('users', {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a Model class as the tableName', () => {
    class User extends Model {}

    User.init({}, { sequelize, tableName: 'custom_users', schema: 'custom_schema' });

    const sql = queryGenerator.changeColumnsQuery(User, {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports passing a TableNameWithSchema as the tableName', () => {
    const sql = queryGenerator.changeColumnsQuery({
      schema: 'custom_schema',
      tableName: 'custom_users',
    }, {
      name: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "custom_schema"."custom_users" ALTER COLUMN "name" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `custom_schema`.`custom_users` MODIFY `name` CHAR(100);',
    });
  });

  it('supports changing more than one column', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: DataTypes.CHAR(100),
      lastName: DataTypes.CHAR(100),
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "lastName" TYPE CHAR(100);',
      mysql: 'ALTER TABLE `users` MODIFY `firstName` CHAR(100), MODIFY `lastName` CHAR(100);',
    });
  });

  it('supports using an ENUM as the DataType', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      name: {
        type: DataTypes.ENUM('A', 'B', 'C'),
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE TYPE "public"."enum_users_name" AS ENUM('A', 'B', 'C');
        ALTER TABLE "users" ALTER COLUMN "name" TYPE "enum_users_name" USING ("name"::"public"."enum_users_name");`,
    });
  });

  it('supports changing all base options', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        type: DataTypes.CHAR(100),
        allowNull: false,
        comment: 'First name of the user',
        defaultValue: 'John',
      },
      lastName: {
        type: DataTypes.CHAR(100),
        allowNull: true,
        defaultValue: 'Smith',
        comment: 'Last name of the user',
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
          ALTER COLUMN "lastName" SET DEFAULT 'Smith';
        COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';
        COMMENT ON COLUMN "users"."lastName" IS 'Last name of the user';`,
      mysql: `
        ALTER TABLE \`users\`
          MODIFY \`firstName\` CHAR(100) NOT NULL DEFAULT 'John' COMMENT 'First name of the user',
          MODIFY \`lastName\` CHAR(100) NULL DEFAULT 'Smith' COMMENT 'Last name of the user';`,
    });
  });

  it('supports changing the allowNull option only (in supported dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        allowNull: false,
      },
      lastName: {
        allowNull: true,
      },
    });

    expectsql(sql, {
      postgres: 'ALTER TABLE "users" ALTER COLUMN "firstName" SET NOT NULL, ALTER COLUMN "lastName" DROP NOT NULL;',
      mysql: new Error('MySQL does not support changing the allowNull option without also specifying the type of the column'),
    });
  });

  it('supports changing the default value only (in supported dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        defaultValue: 'John',
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" SET DEFAULT 'John';`,
      mysql: new Error('MySQL does not support changing the defaultValue option without also specifying the type of the column'),
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
        type: DataTypes.CHAR(100),
        dropDefaultValue: true,
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "firstName" DROP DEFAULT;`,
      mysql: `ALTER TABLE \`users\` MODIFY \`firstName\` CHAR(100), ALTER COLUMN \`firstName\` DROP DEFAULT;`,
    });
  });

  it('supports changing the comment only', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        comment: 'First name of the user',
      },
    });

    expectsql(sql, {
      postgres: `COMMENT ON COLUMN "users"."firstName" IS 'First name of the user';`,
      mysql: new Error('MySQL does not support changing the comment option without also specifying the type of the column'),
    });
  });

  // This test is added because previous versions of Sequelize
  // first generated the query then used regexes to attempt to modify it, which was completely broken because default values can include anything.
  it('does not break if the default value includes special tokens', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      firstName: {
        type: DataTypes.CHAR(100),
        defaultValue: 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT',
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ALTER COLUMN "firstName" TYPE CHAR(100), ALTER COLUMN "firstName" SET DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
      mysql: `ALTER TABLE \`users\` MODIFY \`firstName\` CHAR(100) DEFAULT 'NOT NULL REFERENCES DEFAULT ENUM( UNIQUE; PRIMARY KEY SERIAL BIGINT SMALLINT';`,
    });
  });

  it('supports enabling autoIncrement without other options (in compatible dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        autoIncrement: true,
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE SEQUENCE IF NOT EXISTS "users_int_seq" OWNED BY "users"."int";
        ALTER TABLE "users" ALTER COLUMN "int" SET DEFAULT nextval('users_int_seq'::regclass);`,
    });
  });

  it('supports disabling autoIncrement without other options (in compatible dialects)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        autoIncrement: false,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users" ALTER COLUMN "int" DROP DEFAULT;`,
    });
  });

  it('supports disabling autoIncrement and setting a new default value', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        type: DataTypes.INTEGER,
        autoIncrement: false,
        defaultValue: 14,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users" ALTER COLUMN "int" TYPE INTEGER, ALTER COLUMN "int" SET DEFAULT 14;`,
    });
  });

  it(`supports enabling autoIncrement with 'type' specified (in all dialects)`, () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      smallInt: {
        type: DataTypes.SMALLINT,
        autoIncrement: true,
      },
      int: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
      },
      bigInt: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
      },
    });

    expectsql(sql, {
      postgres: `
        CREATE SEQUENCE IF NOT EXISTS "users_bigInt_seq" OWNED BY "users"."bigInt";
        CREATE SEQUENCE IF NOT EXISTS "users_int_seq" OWNED BY "users"."int";
        CREATE SEQUENCE IF NOT EXISTS "users_smallInt_seq" OWNED BY "users"."smallInt";
        ALTER TABLE "users"
          ALTER COLUMN "smallInt" TYPE SMALLINT,
          ALTER COLUMN "smallInt" SET DEFAULT nextval('users_smallInt_seq'::regclass),
          ALTER COLUMN "int" TYPE INTEGER,
          ALTER COLUMN "int" SET DEFAULT nextval('users_int_seq'::regclass),
          ALTER COLUMN "bigInt" TYPE BIGINT,
          ALTER COLUMN "bigInt" SET DEFAULT nextval('users_bigInt_seq'::regclass);`,
    });
  });

  it(`supports disabling autoIncrement with 'type' specified (in all dialects)`, () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      smallInt: {
        type: DataTypes.SMALLINT,
        autoIncrement: false,
      },
      int: {
        type: DataTypes.INTEGER,
        autoIncrement: false,
      },
      bigInt: {
        type: DataTypes.BIGINT,
        autoIncrement: false,
      },
    });

    expectsql(sql, {
      postgres: `
        ALTER TABLE "users"
          ALTER COLUMN "smallInt" TYPE SMALLINT,
          ALTER COLUMN "smallInt" DROP DEFAULT,
          ALTER COLUMN "int" TYPE INTEGER,
          ALTER COLUMN "int" DROP DEFAULT,
          ALTER COLUMN "bigInt" TYPE BIGINT,
          ALTER COLUMN "bigInt" DROP DEFAULT;`,
    });
  });

  it('supports enabling autoIncrementIdentity (postgres)', () => {
    const sql = queryGenerator.changeColumnsQuery('users', {
      int: {
        autoIncrementIdentity: true,
        allowNull: false,
      },
    });

    expectsql(sql, {
      // nullability must be changed first, because 'generated by default as identity' is not allowed on nullable columns
      postgres: `ALTER TABLE "users" ALTER COLUMN "int" SET NOT NULL, ALTER COLUMN "int" ADD GENERATED BY DEFAULT AS IDENTITY;`,
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
      postgres: 'ALTER TABLE "users" ADD CONSTRAINT "users_id_unique" UNIQUE ("id");',
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
      postgres: `ALTER TABLE "users" ADD FOREIGN KEY ("otherKey") REFERENCES "projects"("id") ON UPDATE CASCADE ON DELETE CASCADE;`,
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
      postgres: `ALTER TABLE "users" ADD FOREIGN KEY ("otherKey") REFERENCES "projects"("id") ON DELETE CASCADE;`,
    });
  });

  it('supports schemas in references', () => {
    class OtherModel extends Model {}

    OtherModel.init({}, { sequelize, tableName: 'otherModel' });

    const sql = queryGenerator.changeColumnsQuery('users', {
      otherKey: {
        references: {
          model: { tableName: 'projects', schema: 'other_schema' },
          key: 'id',
        },
      },
    });

    expectsql(sql, {
      postgres: `ALTER TABLE "users" ADD FOREIGN KEY ("otherKey") REFERENCES "other_schema"."projects"("id");`,
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
