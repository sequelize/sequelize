import type { MigrationMeta, UmzugOptions } from 'umzug/lib/types.js';
import type { UmzugContext } from './get-umzug.js';
import { createUmzug } from './get-umzug.js';

export interface MigrationStatus {
  /** Migrations that have been applied. */
  executed: MigrationMeta[];
  /** Migrations that are pending. */
  pending: MigrationMeta[];
}

export interface GetMigrationStatusOptions {
  /** Optional logger for umzug output. */
  logger?: UmzugOptions<UmzugContext>['logger'];
}

/**
 * Returns the current migration status: which migrations have been executed and which are pending.
 *
 * @param options
 */
export async function getMigrationStatus(
  options?: GetMigrationStatusOptions,
): Promise<MigrationStatus> {
  const { umzug, sequelize } = await createUmzug({ logger: options?.logger });

  try {
    // Run sequentially to avoid a race where two concurrent model.sync() calls both
    // attempt to CREATE UNIQUE INDEX on a brand-new SequelizeMeta table and one fails.
    const executed = await umzug.executed();
    const pending = await umzug.pending();

    return { executed, pending };
  } finally {
    await sequelize.close();
  }
}
