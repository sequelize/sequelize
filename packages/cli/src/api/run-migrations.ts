import type { MigrationMeta, UmzugOptions } from 'umzug/lib/types.js';
import type { UmzugContext } from './get-umzug.js';
import { createUmzug } from './get-umzug.js';

export interface RunMigrationsOptions {
  /** Optional logger for umzug output. */
  logger?: UmzugOptions<UmzugContext>['logger'];
  /** If specified, only run migrations up to and including this name. */
  to?: string;
  /** If specified, only run this many pending migrations. */
  step?: number;
}

/**
 * Runs pending migrations.
 *
 * @param options
 * @returns The list of migrations that were applied.
 */
export async function runMigrations(options?: RunMigrationsOptions): Promise<MigrationMeta[]> {
  if (options?.to != null && options?.step != null) {
    throw new Error('Invalid options: "to" and "step" cannot both be specified.');
  }

  const { umzug, sequelize } = await createUmzug({ logger: options?.logger });

  try {
    return await umzug.up(
      options?.to != null
        ? { to: options.to }
        : options?.step != null
          ? { step: options.step }
          : undefined,
    );
  } finally {
    await sequelize.close();
  }
}

export { type MigrationMeta } from 'umzug/lib/types.js';
