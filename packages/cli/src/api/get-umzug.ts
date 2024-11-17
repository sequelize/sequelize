import type { AbstractDialect } from '@sequelize/core';
import { Sequelize } from '@sequelize/core';
import { isFunction, isNotNullish } from '@sequelize/utils';
import { checkFileExists } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { inspect } from 'node:util';
import { SequelizeStorage, Umzug } from 'umzug';
import type { RunnableMigration, UmzugOptions } from 'umzug/lib/types.js';
import type { Config } from '../_internal/config.js';
import { config } from '../_internal/config.js';

const SUPPORTED_JS_FILE_EXTENSIONS = Object.freeze(['.js', '.ts', '.cjs', '.mjs', '.cts', '.mts']);
const SUPPORTED_SQL_FILE_EXTENSIONS = Object.freeze(['.sql']);

export type UmzugContext = { sequelize: Sequelize };

export async function createUmzug(options: Pick<UmzugOptions<UmzugContext>, 'logger'>) {
  const sequelize = new Sequelize(config.database as Config<AbstractDialect>['database']);

  return new Umzug({
    ...options,
    migrations: universalUmzugMigrations,
    context: {
      sequelize,
    },
    storage: new SequelizeStorage({ sequelize }),
  });
}

async function universalUmzugMigrations(): Promise<Array<RunnableMigration<UmzugContext>>> {
  const { migrationFolder } = config;

  const migrationNames = await fs.readdir(migrationFolder, { withFileTypes: true });

  const migrations = await Promise.all(
    migrationNames.map(async migrationDirent => {
      const filename = path.join(migrationFolder, migrationDirent.name);

      if (migrationDirent.isFile()) {
        const extension = path.extname(filename);

        // supports migrations/<name>.sql (only up, no down)
        if (SUPPORTED_SQL_FILE_EXTENSIONS.includes(extension)) {
          return createSqlMigration(migrationDirent.name, filename, filename);
        }

        // supports migrations/<name>.js & similar
        if (SUPPORTED_JS_FILE_EXTENSIONS.includes(extension)) {
          return createJsMigration(migrationDirent.name, filename);
        }

        return null;
      }

      // supports migrations/<name>/(up|down).sql
      if (migrationDirent.isDirectory()) {
        const upPath = path.join(filename, 'up.sql');
        const downPath = path.join(filename, 'down.sql');

        const hasUp = await checkFileExists(upPath);

        if (!hasUp) {
          return null;
        }

        return createSqlMigration(migrationDirent.name, filename, upPath, downPath);
      }

      return null;
    }),
  );

  return migrations.filter(isNotNullish);
}

function createSqlMigration(
  migrationName: string,
  migrationPath: string,
  upFilename: string,
  downFilename?: string,
): RunnableMigration<UmzugContext> {
  return {
    name: migrationName,
    path: migrationPath,
    up: async migrationParams => {
      const sequelize = migrationParams.context.sequelize;

      const fileContents = await fs.readFile(upFilename, 'utf-8');

      await sequelize.query(fileContents);
    },
    down: async migrationParams => {
      if (downFilename && (await checkFileExists(downFilename))) {
        const sequelize = migrationParams.context.sequelize;

        const fileContents = await fs.readFile(downFilename, 'utf-8');

        await sequelize.query(fileContents);
      }
    },
  };
}

function createJsMigration(
  migrationName: string,
  migrationPath: string,
): RunnableMigration<UmzugContext> {
  return {
    name: migrationName,
    path: migrationPath,
    up: async migrationParams => {
      const migration = await import(migrationPath);
      const up = migration.up ?? migration.default?.up;

      if (!up) {
        throw new Error(`Migration ${inspect(migrationName)} is missing the "up" export`);
      }

      if (!isFunction(up)) {
        throw new Error(
          `Migration ${inspect(migrationName)} has an invalid "up" export: It must be a function, but it is ${inspect(up)}`,
        );
      }

      const sequelize = migrationParams.context.sequelize;

      await up(sequelize.queryInterface, sequelize, migrationParams);
    },
    down: async migrationParams => {
      const migration = await import(migrationPath);
      const down = migration.down ?? migration.default?.down;

      if (down !== undefined && !isFunction(down)) {
        throw new Error(
          `Migration ${inspect(migrationName)} has an invalid "down" export: It must be a function, but it is ${inspect(down)}`,
        );
      }

      if (down) {
        const sequelize = migrationParams.context.sequelize;

        await down(sequelize.queryInterface, sequelize, migrationParams);
      }
    },
  };
}
