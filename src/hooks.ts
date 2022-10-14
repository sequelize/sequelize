import type { Nullish, AllowArray } from './utils/index.js';
import { Multimap } from './utils/multimap.js';

export type AsyncHookReturn = Promise<void> | void;

/**
 * @internal
 */
export class HookHandler<HookConfig extends {}> {
  #validHookNames: Array<keyof HookConfig>;
  #eventTarget: object;
  #listeners = new Multimap<PropertyKey, { listenerName: Nullish<string>, callback: HookConfig[keyof HookConfig] }>();

  constructor(eventTarget: object, validHookNames: Array<keyof HookConfig>) {
    this.#eventTarget = eventTarget;
    this.#validHookNames = validHookNames;
  }

  removeListener(hookName: keyof HookConfig, listenerName: string): void {
    this.#assertValidHookName(hookName);

    const listeners = this.#listeners.getAll(hookName);
    for (const listener of listeners) {
      if (listener.listenerName === listenerName) {
        this.#listeners.delete(hookName, listener);
      }
    }
  }

  hasListeners(hookName: keyof HookConfig): boolean {
    this.#assertValidHookName(hookName);

    return this.#listeners.count(hookName) > 0;
  }

  runSync<HookName extends keyof HookConfig>(
    hookName: HookName,
    ...args: HookConfig[HookName] extends (...args2: any) => any
      ? Parameters<HookConfig[HookName]>
      : never
  ): void {
    this.#assertValidHookName(hookName);

    const listeners = this.#listeners.getAll(hookName);
    for (const listener of listeners) {
      // @ts-expect-error
      const out = listener.callback(...args);

      if (out && 'then' in out) {
        throw new Error(`${listener.listenerName ? `Listener ${listener.listenerName}` : `An unnamed listener`} of hook ${String(hookName)} on ${getName(this.#eventTarget)} returned a Promise, but the hook is synchronous.`);
      }
    }
  }

  async runAsync<HookName extends keyof HookConfig>(
    hookName: HookName,
    ...args: HookConfig[HookName] extends (...args2: any) => any
      ? Parameters<HookConfig[HookName]>
      : never
  ): Promise<void> {
    this.#assertValidHookName(hookName);

    const listeners = this.#listeners.getAll(hookName);
    for (const listener of listeners) {
      /* eslint-disable no-await-in-loop */
      // @ts-expect-error
      await listener.callback(...args);
      /* eslint-enable no-await-in-loop */
    }
  }

  addListener<HookName extends keyof HookConfig>(
    hookName: HookName,
    listener: HookConfig[HookName],
    listenerName?: string,
  ): void {
    this.#assertValidHookName(hookName);

    // TODO: throw if named hook already exists
    this.#listeners.append(hookName, { callback: listener, listenerName });
  }

  addListeners(listeners: {
    [Key in keyof HookConfig]?: AllowArray<HookConfig[Key]>
  }) {
    for (const hookName of this.#validHookNames) {
      const hookListeners = listeners[hookName];
      if (!hookListeners) {
        continue;
      }

      const hookListenersArray = Array.isArray(hookListeners) ? hookListeners : [hookListeners];
      for (const listener of hookListenersArray) {
        this.addListener(hookName, listener);
      }
    }
  }

  #assertValidHookName(hookName: any) {
    if (!this.#validHookNames.includes(hookName)) {
      throw new Error(`Target ${getName(this.#eventTarget)} does not support a hook named "${String(hookName)}".`);
    }
  }
}

export class HookHandlerBuilder<HookConfig extends {}> {
  #validHookNames: Array<keyof HookConfig>;
  #hookHandlers = new WeakMap<object, HookHandler<HookConfig>>();

  constructor(validHookNames: Array<keyof HookConfig>) {
    this.#validHookNames = validHookNames;
  }

  getFor(target: object): HookHandler<HookConfig> {
    let hookHandler = this.#hookHandlers.get(target);
    if (!hookHandler) {
      hookHandler = new HookHandler<HookConfig>(target, this.#validHookNames);
      this.#hookHandlers.set(target, hookHandler);
    }

    return hookHandler;
  }
}

function getName(obj: object) {
  if (typeof obj === 'function') {
    return `[class ${obj.name}]`;
  }

  return `[instance ${obj.constructor.name}]`;
}
