import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * A continuation-local storage context. Reads fall through to the parent chain;
 * writes land on this context only, so a value set in a child shadows the parent
 * rather than overwriting it and disappears when the child does.
 */
export class CLSContext {
  constructor(parent) {
    this.parent = parent;
    this.values = new Map();
  }

  /**
   * @param {string} key Context key
   * @returns {*} Value for `key`, walking up the parent chain; `undefined` if unset
   */
  get(key) {
    let context = this;

    while (context) {
      if (context.values.has(key)) {
        return context.values.get(key);
      }

      context = context.parent;
    }

    return undefined;
  }
}

/**
 * An `AsyncLocalStorage`-backed continuation-local storage namespace, suitable for
 * passing to `Sequelize.useCLS()`. Create one with `Sequelize.createCLSNamespace()`.
 *
 * Historically this had to be supplied by the caller, in practice via `cls-hooked`.
 * That package is unmaintained and built on legacy `async_hooks` context capture,
 * which can lose context across async boundaries under concurrency;
 * `AsyncLocalStorage` is the supported primitive and propagates through every
 * promise continuation.
 *
 * Implements the `cls-hooked` namespace API that Sequelize itself calls — `get`,
 * `set`, `run` and `bind` — plus `createContext` and `runAndReturn`. It does not
 * implement `enter`/`exit`: those install an ambient context with no async scope,
 * which is a test-harness affordance rather than something Sequelize needs. A
 * consumer that wants them can subclass and override {@link CLSNamespace#_activeContext}:
 *
 * ```js
 * class HarnessNamespace extends CLSNamespace {
 *   _activeContext() {
 *     return super._activeContext() || this._entered;
 *   }
 *   enter(context) {
 *     this._entered = context;
 *   }
 *   exit(context) {
 *     if (this._entered === context) this._entered = undefined;
 *   }
 * }
 * ```
 */
export class CLSNamespace {
  constructor(name = 'sequelize') {
    this.name = name;
    this._als = new AsyncLocalStorage();
  }

  /**
   * The context reads and writes resolve against. Overridable so a subclass can add
   * a fallback for code running outside any `run()`/`bind()` scope.
   *
   * @protected
   * @returns {CLSContext|undefined} Active context, if any
   */
  _activeContext() {
    return this._als.getStore();
  }

  /**
   * The active context, or `null` outside of any context. Present for `cls-hooked`
   * API parity; Sequelize does not use it.
   *
   * @returns {CLSContext|null} Active context
   */
  get active() {
    return this._activeContext() || null;
  }

  /**
   * @param {string} key Context key
   * @returns {*} Value for `key`, or `undefined` if unset or outside a context
   */
  get(key) {
    const context = this._activeContext();

    return context ? context.get(key) : undefined;
  }

  /**
   * Writes to the active context, mutating it in place rather than entering a new
   * one. The write is therefore visible to everything sharing that context,
   * including code that resumes after an `await` in the same `run()` scope —
   * `Transaction#prepareEnvironment` sets the ambient transaction that way.
   *
   * Throws outside of a context, matching `cls-hooked`.
   *
   * @param {string} key Context key
   * @param {*} value Value to store
   * @returns {*} The stored value
   */
  set(key, value) {
    const context = this._activeContext();

    if (!context) {
      throw new Error('No context available. ns.run() must be called first.');
    }

    context.values.set(key, value);

    return value;
  }

  /**
   * @returns {CLSContext} A context inheriting from the active one, if any
   */
  createContext() {
    return new CLSContext(this._activeContext());
  }

  /**
   * Runs `fn` in a fresh context inheriting from the enclosing one.
   *
   * The inheritance is load-bearing: it is what lets a nested `sequelize.transaction()`
   * see the ambient transaction and open a SAVEPOINT on it, while the nested
   * `set('transaction', …)` stays scoped to the callback.
   *
   * Returns the context rather than `fn`'s return value, matching `cls-hooked`;
   * `Sequelize._clsRun` captures the result from inside the callback.
   *
   * @param {Function} fn Function to run, called with the new context
   * @returns {CLSContext} The context `fn` ran in
   */
  run(fn) {
    const context = this.createContext();

    this._als.run(context, fn, context);

    return context;
  }

  /**
   * As {@link CLSNamespace#run}, but returns `fn`'s return value.
   *
   * @param {Function} fn Function to run, called with the new context
   * @returns {*} Return value of `fn`
   */
  runAndReturn(fn) {
    const context = this.createContext();

    return this._als.run(context, fn, context);
  }

  /**
   * Binds `fn` to a context so it runs inside that context whenever it is called.
   *
   * @param {Function} fn Function to bind
   * @param {CLSContext} [context] Context to bind to; defaults to a child of the active one
   * @returns {Function} Bound function
   */
  bind(fn, context) {
    const bound = context || this.createContext();

    return (...args) => this._als.run(bound, fn, ...args);
  }
}

/**
 * The ambient CLS transaction, if there is one.
 *
 * `useCLS` installs the namespace on the `Sequelize` class rather than on an instance, so every
 * instance in the process shares one ambient transaction. A `Transaction` owns a connection from
 * the pool of the instance that opened it, so handing it to a query on a *different* instance is
 * never right: the query silently runs on the other instance's transaction connection instead of
 * its own pool, joining a transaction it has nothing to do with and reading its uncommitted rows.
 *
 * That is easy to hit whenever a process keeps a second instance for a distinct workload — a cache
 * loader, a reporting replica — because nothing at the call site suggests a transaction is in play.
 * Ignoring the foreign transaction is the only defensible reading; there is no case where running
 * on another instance's connection is what the caller wanted.
 *
 * @param {Sequelize} sequelize The instance the query is about to run on
 * @returns {Transaction|undefined} The ambient transaction, or `undefined` if there is none or it
 *   belongs to another instance
 */
export function getClsTransactionFor(sequelize) {
  const cls = sequelize.constructor._cls;

  if (!cls) {
    return undefined;
  }

  const transaction = cls.get('transaction');

  if (!transaction || transaction.sequelize !== sequelize) {
    return undefined;
  }

  return transaction;
}
