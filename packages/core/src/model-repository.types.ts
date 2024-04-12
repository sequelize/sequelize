import type { StrictRequiredBy } from '@sequelize/utils';
import type { QiBulkDeleteOptions } from './abstract-dialect/query-interface.types.js';
import type { NewHookable } from './hooks.js';
import type { Attributes, Model } from './model.js';

export enum ManualOnDelete {
  /**
   * Only replicates the behavior of ON DELETE in JS for soft deletions,
   * otherwise is equivalent to "none".
   */
  paranoid = 'paranoid',

  /**
   * Lets the database delete the cascading instances, does nothing in JS.
   * Most efficient, but not compatible with soft deletions.
   */
  none = 'none',

  /**
   * Pre-deletes every cascading model in JS before deleting the current instance.
   * Useful if you need to trigger the JS hooks for cascading deletes,
   * or if foreign key constraints are disabled in the database.
   *
   * This is the least efficient option.
   */
  all = 'all',
}

export interface CommonDestroyOptions {
  /**
   * If set to true, paranoid models will actually be deleted instead of soft deleted.
   */
  hardDelete?: boolean | undefined;

  /**
   * Manually handles the behavior of ON DELETE in JavaScript, instead of using the native database ON DELETE behavior.
   * This option is useful when:
   * - The deletion is a soft deletion.
   * - You wish to run JS delete hooks for the cascading models.
   *
   * @default 'paranoid'
   */
  manualOnDelete?: ManualOnDelete | undefined;
}

/**
 * Used by {@link ModelRepository#_UNSTABLE_destroy}
 */
export interface DestroyManyOptions
  extends NewHookable<'beforeDestroyMany' | 'afterDestroyMany'>,
    Omit<QiBulkDeleteOptions, 'where' | 'limit'>,
    CommonDestroyOptions {}

/**
 * Used by {@link ModelRepository#_UNSTABLE_bulkDestroy}
 */
export interface BulkDestroyOptions<TModel extends Model>
  extends NewHookable<'_UNSTABLE_beforeBulkDestroy' | '_UNSTABLE_afterBulkDestroy'>,
    StrictRequiredBy<QiBulkDeleteOptions<Attributes<TModel>>, 'where'>,
    CommonDestroyOptions {}
