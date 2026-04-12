import { Sequelize } from '@sequelize/core';
import { isFunction } from '@sequelize/utils';
import { checkFileExists } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspect } from 'node:util';
import { SequelizeStorage, Umzug } from 'umzug';
import type { Resolver, RunnableMigration, UmzugOptions } from 'umzug/lib/types.js';
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
    migrations: getUniversalUmzugMigrations(),
    context: {
      sequelize,
    },
    storage: new SequelizeStorage({ sequelize }),
  });

  return { umzug, sequelize };
}

function getUniversalUmzugMigrations(): UmzugOptions<UmzugContext>['migrations'] {
  const { migrationFolder } = config;

  return {
    glob: path.join(migrationFolder, '{*.{js,ts,cjs,mjs,cts,mts,sql},*/up.sql}'),
    resolve: migration => {
      if (!migration.path) {
        throw new Error(`Migration ${inspect(migration.name)} is missing its file path.`);
      }

      const migrationPath = migration.path;

      // supports migrations/<name>/(up|down).sql
      if (path.basename(migrationPath) === 'up.sql') {
        const migrationDir = path.dirname(migrationPath);

        return createSqlMigration(
          path.basename(migrationDir),
          migrationDir,
          migrationPath,
          path.join(migrationDir, 'down.sql'),
        );
      }

      const extension = path.extname(migrationPath);

      // supports migrations/<name>.sql (only up, no down)
      if (SUPPORTED_SQL_FILE_EXTENSIONS.includes(extension)) {
        return createSqlMigration(migration.name, migrationPath, migrationPath);
      }

      // supports migrations/<name>.js & similar
      if (SUPPORTED_JS_FILE_EXTENSIONS.includes(extension)) {
        return createJsMigration(migration.name, migrationPath);
      }

      throw new Error(
        `Unsupported migration file ${inspect(migrationPath)}. Supported extensions are ${SUPPORTED_JS_FILE_EXTENSIONS.join(', ')} and ${SUPPORTED_SQL_FILE_EXTENSIONS.join(', ')}`,
      );
    },
  } satisfies {
    glob: string;
    resolve: Resolver<UmzugContext>;
  };
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
