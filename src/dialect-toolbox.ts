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
export const kSetDialectNames = Symbol('sequelize.dialect-toolbox.set-type-names');

/**
 * A symbol that can be used as the key for a static property on a DataType class to specify that
 * this class is the dialect-specific override of another DataType class.
 *
 * Users always use base DataTypes (from the Abstract dialect), and Sequelize then maps
 * these DataTypes to the dialect-specific implementation.
 */
export const kIsDataTypeOverrideOf = Symbol('IsDataTypeOverrideOf');
