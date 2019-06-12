'use strict';

const _ = require('lodash');
const { logger } = require('./utils/logger');
const Promise = require('./promise');
const debug = logger.debugContext('hooks');

const hookTypes = {
  beforeValidate: { params: 2 },
  afterValidate: { params: 2 },
  validationFailed: { params: 3 },
  beforeCreate: { params: 2 },
  afterCreate: { params: 2 },
  beforeDestroy: { params: 2 },
  afterDestroy: { params: 2 },
  beforeRestore: { params: 2 },
  afterRestore: { params: 2 },
  beforeUpdate: { params: 2 },
  afterUpdate: { params: 2 },
  beforeSave: { params: 2, proxies: ['beforeUpdate', 'beforeCreate'] },
  afterSave: { params: 2, proxies: ['afterUpdate', 'afterCreate'] },
  beforeUpsert: { params: 2 },
  afterUpsert: { params: 2 },
  beforeBulkCreate: { params: 2 },
  afterBulkCreate: { params: 2 },
  beforeBulkDestroy: { params: 1 },
  afterBulkDestroy: { params: 1 },
  beforeBulkRestore: { params: 1 },
  afterBulkRestore: { params: 1 },
  beforeBulkUpdate: { params: 1 },
  afterBulkUpdate: { params: 1 },
  beforeFind: { params: 1 },
  beforeFindAfterExpandIncludeAll: { params: 1 },
  beforeFindAfterOptions: { params: 1 },
  afterFind: { params: 2 },
  beforeCount: { params: 1 },
  beforeDefine: { params: 2, sync: true, noModel: true },
  afterDefine: { params: 1, sync: true, noModel: true },
  beforeInit: { params: 2, sync: true, noModel: true },
  afterInit: { params: 1, sync: true, noModel: true },
  beforeAssociate: { params: 2, sync: true },
  afterAssociate: { params: 2, sync: true },
  beforeConnect: { params: 1, noModel: true },
  afterConnect: { params: 2, noModel: true },
  beforeSync: { params: 1 },
  afterSync: { params: 1 },
  beforeBulkSync: { params: 1, noModel: true },
  afterBulkSync: { params: 1, noModel: true },
  beforeQuery: { params: 2 },
  afterQuery: { params: 2 },
  afterCommit: { params: 1 }
};
exports.hooks = hookTypes;


/**
 * get array of current hook and its proxies combined
 *
 * @param {string} hookType any hook type @see {@link hookTypes}
 *
 * @private
 */
const getProxiedHooks = hookType =>
  hookTypes[hookType].proxies
    ? hookTypes[hookType].proxies.concat(hookType)
    : [hookType]
;

class Hooks {
  _getHooks(hookType) {
    return this.hooks[hookType] || [];
  }
  /**
   * Process user supplied hooks definition
   *
   * @param {object} hooks hooks definition
   * @param {Hooks} parent
   * @private
   */
  constructor(hooks, parent) {
    this.hooks = {};
    this.parent = parent;
    if (!hooks) {
      return;
    }
    _.map(hooks, (hooksArray, hookName) => {
      if (!Array.isArray(hooksArray)) hooksArray = [hooksArray];
      hooksArray.forEach(hookFn => this.add(hookName, hookFn));
    });
  }

  run(hooks, ...hookArgs) {
    if (!hooks) throw new Error('hooks.run requires at least 1 argument');

    let hookType;

    if (typeof hooks === 'string') {
      hookType = hooks;
      hooks = this._getHooks(hookType);

      if (this.parent) {
        hooks = hooks.concat(this.parent._getHooks(hookType));
      }
    }

    if (!Array.isArray(hooks)) {
      hooks = [hooks];
    }

    // synchronous hooks
    if (hookTypes[hookType] && hookTypes[hookType].sync) {
      for (const hook of hooks) {
        debug(`running hook(sync) ${hookType}`);
        hook.fn(...hookArgs);
      }
      return;
    }

    // asynchronous hooks (default)
    return Promise.each(hooks, hook => {
      debug(`running hook ${hookType}`);
      return hook.fn(...hookArgs);
    }).return();
  }

  /**
   * Add a hook to the model
   *
   * @param {string}          hookType hook name @see {@link hookTypes}
   * @param {Function}        fn The hook function
   */
  add(hookType, fn) {
    if (hookTypes[hookType] && hookTypes[hookType].noModel && this.parent) {
      throw new Error(`${hookType} is only applicable on a sequelize instance or static`);
    }
    debug(`adding hook ${hookType}`);
    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    hookType.forEach(type => {
      const hooks = this._getHooks(type);
      hooks.push({ fn });
      this.hooks[type] = hooks;
    });

    return this;
  }

  /**
   * Remove hook from the model
   *
   * @param {string} hookType @see {@link hookTypes}
   * @param {Function} fn name of hook or function reference which was attached
   */
  remove(hookType, fn) {
    if (!this.has(hookType)) {
      return this;
    }

    debug(`removing hook ${hookType}`);

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    for (const type of hookType) {
      this.hooks[type] = this.hooks[type].filter(({ fn: hookFn }) => fn !== hookFn);
    }

    return this;
  }

  /**
   * Check whether the mode has any hooks of this type
   *
   * @param {string} hookType @see {@link hookTypes}
   */
  has(hookType) {
    return this.hooks[hookType] && !!this.hooks[hookType].length;
  }

  /**
   * Removes all hooks
   */
  removeAll() {
    this.hooks = {};
  }
}
exports.Hooks = Hooks;
