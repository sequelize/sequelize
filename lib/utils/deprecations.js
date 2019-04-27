'use strict';

const { deprecate } = require('util');

const noop = () => {};

exports.noRawAttributes = deprecate(noop, 'Use sequelize.fn / sequelize.literal to construct attributes', 'SEQUELIZE0001');
exports.noTrueLogging = deprecate(noop, 'The logging-option should be either a function or false. Default: console.log', 'SEQUELIZE0002');
exports.noStringOperators = deprecate(noop, 'String based operators are deprecated. Please use Symbol based operators for better security, read more at http://docs.sequelizejs.com/manual/querying.html#operators', 'SEQUELIZE0003');
exports.noBoolOperatorAliases = deprecate(noop, 'A boolean value was passed to options.operatorsAliases. This is a no-op with v5 and should be removed.', 'SEQUELIZE0004');
exports.noDoubleNestedGroup = deprecate(noop, 'Passing a double nested nested array to `group` is unsupported and will be removed in v6.', 'SEQUELIZE0005');
