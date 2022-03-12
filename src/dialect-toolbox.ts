/**
 * @file Contains shared items essential for dialect-specific code.
 * @public
 */

/**
 * A symbol which is used in data-types as the key of a function which registers dialect-specific
 * variations of a type.
 *
 * @public
 */
export const kSetDialectNames = Symbol(
  'sequelize.dialect-toolbox.set-type-names',
);
