import type { Options as SequelizeOptions } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { cosmiconfig } from 'cosmiconfig';
import * as path from 'node:path';
import { z } from 'zod/v3';

const explorer = cosmiconfig('sequelize');
const result = await explorer.search();

const projectRoot = result?.filepath ? path.dirname(result.filepath) : process.cwd();

/** A concrete dialect constructor (not an instance). */
export type DialectClass = new (...args: any[]) => AbstractDialect;

/**
 * Resolves a dialect from either a class constructor or an import-path string.
 *
 * Import path format: `"package"` (default export) or `"package#ExportName"` (named export).
 * Example: `"@sequelize/postgres#PostgresDialect"`
 *
 * @param input
 */
async function resolveDialectClass(input: DialectClass | string): Promise<DialectClass> {
  if (typeof input !== 'string') {
    return input;
  }

  const hashIndex = input.indexOf('#');
  const modulePath = hashIndex >= 0 ? input.slice(0, hashIndex) : input;
  const exportName = hashIndex >= 0 ? input.slice(hashIndex + 1) : undefined;

  const mod = await import(modulePath);

  const dialectClass = exportName != null ? mod[exportName] : mod.default;

  if (typeof dialectClass !== 'function') {
    const ref = exportName != null ? `named export "${exportName}"` : 'default export';
    throw new Error(
      `Failed to resolve dialect from "${input}": the ${ref} of "${modulePath}" is not a class.`,
    );
  }

  return dialectClass as DialectClass;
}

const dialectInputSchema = z.union([
  // A dialect class constructor (e.g. PostgresDialect)
  z.custom<DialectClass>(
    val => typeof val === 'function' && val.prototype instanceof AbstractDialect,
    'dialect must be a dialect class (e.g. PostgresDialect) or an import path string (e.g. "@sequelize/postgres#PostgresDialect")',
  ),
  // An import path string (e.g. "@sequelize/postgres" or "@sequelize/postgres#PostgresDialect")
  z.string().min(1),
]);

const configSchema = z.strictObject({
  migrationFolder: z
    .string()
    .default('/migrations')
    .transform(val => path.join(projectRoot, val)),
  seedFolder: z
    .string()
    .default('/seeds')
    .transform(val => path.join(projectRoot, val)),
  // Optional at the schema level so commands that do not need a database (e.g. migration generate)
  // can run without one. createUmzug() enforces its presence with a clear error at runtime.
  database: z.object({ dialect: dialectInputSchema }).passthrough().optional(),
});

/**
 * The resolved Sequelize CLI configuration. The `dialect` field is always a dialect class
 * (never a string), resolved from the user's config file at startup.
 */
export type Config<Dialect extends AbstractDialect = AbstractDialect> = {
  migrationFolder: string;
  seedFolder: string;
  /**
   * Options passed to the Sequelize constructor.
   *
   * The `dialect` field must be either a dialect class (e.g. `PostgresDialect`) or an
   * import-path string (e.g. `"@sequelize/postgres#PostgresDialect"`).
   */
  database: Omit<SequelizeOptions<Dialect>, 'dialect'> & {
    dialect: new (...args: any[]) => Dialect;
  };
};

const rawConfig = configSchema.parse(result?.config || {});
const resolvedDialect = rawConfig.database
  ? await resolveDialectClass(rawConfig.database.dialect)
  : undefined;

export const config: Config<AbstractDialect> = {
  ...rawConfig,
  ...(resolvedDialect != null && rawConfig.database != null
    ? { database: { ...rawConfig.database, dialect: resolvedDialect } }
    : {}),
} as Config<AbstractDialect>;
