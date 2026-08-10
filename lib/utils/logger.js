/**
 * Sequelize module for debug and deprecation messages.
 * It require a `context` for which messages will be printed.
 *
 * @module logging
 * @private
 */

import { deprecate as nodeDeprecate } from 'node:util';
import debug from 'debug';

// Upper bound on distinct deprecation messages kept for de-duplication. lib/ only
// emits a dozen or so fixed messages; the cap exists because `Utils.validateParameter`
// lets user code build messages from arbitrary values, which would grow the cache
// without limit. Past the cap the warning is still emitted, just no longer de-duped.
const MAX_CACHED_DEPRECATIONS = 100;

class Logger {
  constructor(config) {
    this.config = Object.assign(
      {
        context: 'sequelize',
        debug: true
      },
      config || {}
    );

    this.debug = debug(this.config.context);
    // `util.deprecate` wraps a function and warns the first time that wrapper is
    // called, so one wrapper is cached per message to keep depd's behaviour of
    // emitting each distinct deprecation once.
    this.deprecations = new Map();
  }

  deprecate(message) {
    let warn = this.deprecations.get(message);
    if (!warn) {
      warn = nodeDeprecate(() => {}, `(${this.config.context}) ${message}`);
      if (this.deprecations.size < MAX_CACHED_DEPRECATIONS) {
        this.deprecations.set(message, warn);
      }
    }

    warn();
  }

  warn(message) {
    console.warn(`(${this.config.context}) Warning: ${message}`);
  }

  debugContext(childContext) {
    if (!childContext) {
      throw new Error('No context supplied to debug');
    }

    return debug([this.config.context, childContext].join(':'));
  }
}

export default Logger;
