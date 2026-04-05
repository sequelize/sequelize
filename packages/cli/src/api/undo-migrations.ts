import type { MigrationMeta, UmzugOptions } from 'umzug/lib/types.js';
import type { UmzugContext } from './get-umzug.js';
import { createUmzug } from './get-umzug.js';

export interface UndoMigrationsOptions {
  /** Optional logger for umzug output. */
  logger?: UmzugOptions<UmzugContext>['logger'];
  /**
   * Revert migrations down to and including this name, or pass `0` to revert all.
   * Mutually exclusive with `step`.
   */
  to?: string | 0;
  /**
   * Number of migrations to revert. Defaults to 1.
   * Mutually exclusive with `to`.
   */
  step?: number;
}

/**
 * Reverts executed migrations.
 *
 * By default, reverts only the last migration. Pass `to: 0` to revert all,
 * `to: <name>` to revert down to a specific migration, or `step: N` to revert N migrations.
 *
 * @param options
 * @returns The list of migrations that were reverted.
 */
export async function undoMigrations(options?: UndoMigrationsOptions): Promise<MigrationMeta[]> {
  if (options?.to != null && options?.step != null) {
    throw new Error('Invalid options: "to" and "step" cannot both be specified.');
  }

  const { umzug, sequelize } = await createUmzug({ logger: options?.logger });

  try {
    if (options?.to != null) {
      return await umzug.down({ to: options.to });
    }

    return await umzug.down(options?.step != null ? { step: options.step } : undefined);
  } finally {
    await sequelize.close();
  }
}
