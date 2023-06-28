import isPlainObject from 'lodash/isPlainObject';
import SequelizeOriginal from '../lib/index.js';

export default class Sequelize extends SequelizeOriginal {
  // Force `disableClsTransactions: true` option in `Sequelize()` constructor `options`.
  // The reason is that the "CLS" (Continuation Local Storage) feature for automatically
  // selecting the "current" transaction in any queries dispatched from a transaction's `callback`
  // requires the use of `AsyncLocalStorage` from `node:async_hook` which is not available in a web browser.
  constructor(database, username, password, options) {
    super(transformOptions(database), transformOptions(username), transformOptions(password), transformOptions(options));
  }
}

function transformOptions(options) {
  if (isPlainObject(options)) {
    return {
      ...options,
      disableClsTransactions: true,
    };
  }

  return options;
}
