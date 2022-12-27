import { Multimap } from './utils/multimap.js';
import type { AllowArray, Nullish } from './utils/types.js';

export type AsyncHookReturn = Promise<void> | void;

type HookParameters<Hook> = Hook extends (...args2: any) => any
  ? Parameters<Hook>
  : never;

type OnRunHook<HookConfig extends {}> = <HookName extends keyof HookConfig>(
  eventTarget: object,
  isAsync: boolean,
  hookName: HookName,
  args: HookParameters<HookConfig[HookName]>
) => AsyncHookReturn;

/**
 * @private
 */
export class HookHandler<HookConfig extends {}> {
  #validHookNames: Array<keyof HookConfig>;
  #eventTarget: object;
  #listeners = new Multimap<PropertyKey, { listenerName: Nullish<string>, callback: HookConfig[keyof HookConfig] }>();
  #onRunHook: OnRunHook<HookConfig> | undefined;

  constructor(
    eventTarget: object,
    validHookNames: Array<keyof HookConfig>,
    onRunHook?: OnRunHook<HookConfig>,
  ) {
    this.#eventTarget = eventTarget;
    this.#validHookNames = validHookNames;
    this.#onRunHook = onRunHook;
  }

  removeListener<HookName extends keyof HookConfig>(
    hookName: HookName,
    listenerOrListenerName: string | HookConfig[HookName],
  ): void {
    this.#assertValidHookName(hookName);

    if (typeof listenerOrListenerName === 'string') {
      const listener = this.#getNamedListener(hookName, listenerOrListenerName);
      if (listener) {
        this.#listeners.delete(hookName, listener);
      }
    } else {
      const listeners = this.#listeners.getAll(hookName);
      for (const listener of listeners) {
        if (listener.callback === listenerOrListenerName) {
          this.#listeners.delete(hookName, listener);
        }
      }
    }
  }

  removeAllListeners() {
    this.#listeners.clear();
  }

  #getNamedListener<HookName extends keyof HookConfig>(
    hookName: HookName,
    listenerName: string,
  ): { listenerName: Nullish<string>, callback: HookConfig[keyof HookConfig] } | null {
    const listeners = this.#listeners.getAll(hookName);
    for (const listener of listeners) {
      if (listener.listenerName === listenerName) {
        return listener;
      }
    }

    return null;
  }

  hasListeners(hookName: keyof HookConfig): boolean {
    this.#assertValidHookName(hookName);

    return this.#listeners.count(hookName) > 0;
  }

  getListenerCount(hookName: keyof HookConfig): number {
    this.#assertValidHookName(hookName);

    return this.#listeners.count(hookName);
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
      // @ts-expect-error -- callback can by any hook type (due to coming from the map), args is the args of a specific hook. Too hard to type properly.
      const out = listener.callback(...args);

      if (out && 'then' in out) {
        throw new Error(`${listener.listenerName ? `Listener ${listener.listenerName}` : `An unnamed listener`} of hook ${String(hookName)} on ${getName(this.#eventTarget)} returned a Promise, but the hook is synchronous.`);
      }
    }

    if (this.#onRunHook) {
      void this.#onRunHook(this.#eventTarget, false, hookName, args);
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
      // @ts-expect-error -- callback can by any hook type (due to coming from the map), args is the args of a specific hook. Too hard to type properly.
      await listener.callback(...args);
      /* eslint-enable no-await-in-loop */
    }

    if (this.#onRunHook) {
      await this.#onRunHook(this.#eventTarget, true, hookName, args);
    }
  }

  addListener<HookName extends keyof HookConfig>(
    hookName: HookName,
    listener: HookConfig[HookName],
    listenerName?: string,
  ): void {
    this.#assertValidHookName(hookName);

    if (listenerName) {
      const existingListener = this.#getNamedListener(hookName, listenerName);

      if (existingListener) {
        throw new Error(`Named listener ${listenerName} already exists for hook ${String(hookName)} on ${getName(this.#eventTarget)}.`);
      }
    }

    this.#listeners.append(hookName, { callback: listener, listenerName });
  }

  addListeners(listeners: {
    [Key in keyof HookConfig]?: AllowArray<HookConfig[Key] | { name: string | symbol, callback: HookConfig[Key] }>
  }) {
    for (const hookName of this.#validHookNames) {
      const hookListeners = listeners[hookName];
      if (!hookListeners) {
        continue;
      }

      const hookListenersArray = Array.isArray(hookListeners) ? hookListeners : [hookListeners];
      for (const listener of hookListenersArray) {
        if (typeof listener === 'function') {
          this.addListener(hookName, listener);
        } else {
          this.addListener(hookName, listener.callback, listener.name);
        }
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
  #onRunHook: OnRunHook<HookConfig> | undefined;

  constructor(validHookNames: Array<keyof HookConfig>, onRunHook?: OnRunHook<HookConfig>) {
    this.#validHookNames = validHookNames;
    this.#onRunHook = onRunHook;
  }

  getFor(target: object): HookHandler<HookConfig> {
    let hookHandler = this.#hookHandlers.get(target);
    if (!hookHandler) {
      hookHandler = new HookHandler<HookConfig>(target, this.#validHookNames, this.#onRunHook);
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
