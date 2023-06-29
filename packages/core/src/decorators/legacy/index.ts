/**
 * This package exports all decorators that are available in Sequelize, built using the legacy stage-3 decorators proposal.
 *
 * All available decorators can be imported as follows:
 *
 * ```js
 * import { HasOne, Attribute } from '@sequelize/core/decorators-legacy';
 * ```
 *
 * @module decorators-legacy
 */

export * from './model-hooks.js';
export * from './attribute.js';
export * from './table.js';
export * from './validation.js';
export { HasOne, HasMany, BelongsTo, BelongsToMany } from './associations.js';
