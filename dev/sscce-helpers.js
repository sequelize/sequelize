'use strict';

const Support = require('../packages/core/test/support');

module.exports = {
  createSequelizeInstance(options = {}) {
    return Support.createSequelizeInstance({
      logging: console.debug,
      logQueryParameters: true,
      ...options,
    });
  },
};
