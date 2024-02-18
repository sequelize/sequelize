'use strict';

/**
 * A Sequelize module that contains the sequelize entry point.
 *
 * @module sequelize
 */

/** Exports the sequelize entry point. */
const { Sequelize } = require('./sequelize');

// for backward compatibility, Sequelize is importable with both of these styles:
//  const Sequelize = require('@sequelize/core')
//  const { Sequelize } = require('@sequelize/core')
// TODO [>7]: Make sequelize only importable using the second form, so we can remove properties from the constructor
module.exports = Sequelize;
module.exports.Sequelize = Sequelize;
module.exports.default = Sequelize;
