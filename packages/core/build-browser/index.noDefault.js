// Fixes the `Sequelize` global variable being an object of shape:
// `{ default: Sequelize }`.
// https://github.com/evanw/esbuild/issues/869

import Sequelize from './index.js';

module.exports = Sequelize;
