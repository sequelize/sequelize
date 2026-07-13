import { Sequelize } from '@sequelize/core';
import { isFunction, isNotNullish } from '@sequelize/utils';
import { checkFileExists, isNodeError } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { SequelizeStorage, Umzug } from 'umzug';
import type { RunnableMigration, UmzugOptions } from 'umzug/lib/types.js';
import { config } from '../_internal/config.js';

const SUPPORTED_JS_FILE_EXTENSIONS = Object.freeze(['.js', '.ts', '.cjs', '.mjs', '.cts', '.mts']);
const SUPPORTED_SQL_FILE_EXTENSIONS = Object.freeze(['.sql']);

export type UmzugContext = { sequelize: Sequelize };

export async function createUmzug(options: Pick<UmzugOptions<UmzugContext>, 'logger'>) {
  if (!config.database) {
    throw new Error(
      'No database configuration found. Please add a "database" entry to your sequelize config file.',
    );
  }

  const sequelize = new Sequelize(config.database);

  const umzug = new Umzug({
    ...options,
    migrations: await getUniversalUmzugMigrations(),
    context: {
      sequelize,
    },
    storage: new SequelizeStorage({ sequelize }),
  });

  return { umzug, sequelize };
}

async function getUniversalUmzugMigrations(): Promise<Array<RunnableMigration<UmzugContext>>> {
  const { migrationFolder } = config;

  let migrationNames;

  try {
    migrationNames = await fs.readdir(migrationFolder, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(
        `Migration folder not found at path ${inspect(migrationFolder)}. Please ensure the "migrationFolder" entry in your config points to the correct location.`,
      );
    }

    throw error;
  }

  const migrations = await Promise.all(
    migrationNames
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async migrationDirent => {
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
      if (!downFilename || !(await checkFileExists(downFilename))) {
        throw new Error(`Migration ${inspect(migrationName)} does not have a down migration file.`);
      }

      const sequelize = migrationParams.context.sequelize;
      const fileContents = await fs.readFile(downFilename, 'utf-8');
      await sequelize.query(fileContents);
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
      const migration = await import(pathToFileURL(migrationPath).href);
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
      const migration = await import(pathToFileURL(migrationPath).href);
      const down = migration.down ?? migration.default?.down;

      if (!down) {
        throw new Error(
          `Migration ${inspect(migrationName)} is missing the "down" export, so cannot be reverted.`,
        );
      }

      if (!isFunction(down)) {
        throw new Error(
          `Migration ${inspect(migrationName)} has an invalid "down" export: It must be a function, but it is ${inspect(down)}`,
        );
      }

      const sequelize = migrationParams.context.sequelize;

      await down(sequelize.queryInterface, sequelize, migrationParams);
    },
  };
}
