import type { QiBulkDeleteOptions } from './abstract-dialect/query-interface.types.js';
import type { NewHookable } from './hooks.js';

/**
 * Used by {@link ModelRepository#_UNSTABLE_destroy}
 */
export interface DestroyManyOptions
  extends NewHookable<'beforeDestroyMany' | 'afterDestroyMany'>,
    Omit<QiBulkDeleteOptions, 'where' | 'limit'> {
  /**
   * If set to true, paranoid models will actually be deleted instead of soft deleted.
   */
  hardDelete?: boolean | undefined;
}
