import type { AllowArray, Nullish } from '@sequelize/utils';
import { MultiMap } from '@sequelize/utils';

export type AsyncHookReturn = Promise<void> | void;

type HookParameters<Hook> = Hook extends (...args2: any) => any ? Parameters<Hook> : never;

type OnRunHook<HookConfig extends {}> = <HookName extends keyof HookConfig>(
  eventTarget: object,
  isAsync: boolean,
  hookName: HookName,
  args: HookParameters<HookConfig[HookName]>,
) => AsyncHookReturn;

/**
 * @private
 */
export class HookHandler<HookConfig extends {}> {
  readonly #validHookNames: Array<keyof HookConfig>;
  readonly #eventTarget: object;
  readonly #listeners = new MultiMap<
    PropertyKey,
    { listenerName: string | Nullish; callback: HookConfig[keyof HookConfig] }
  >();

  readonly #onRunHook: OnRunHook<HookConfig> | undefined;

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
        this.#listeners.deleteValue(hookName, listener);
      }
    } else {
      const listeners = this.#listeners.get(hookName);
      for (const listener of listeners) {
        if (listener.callback === listenerOrListenerName) {
          this.#listeners.deleteValue(hookName, listener);
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
  ): { listenerName: string | Nullish; callback: HookConfig[keyof HookConfig] } | null {
    const listeners = this.#listeners.get(hookName);
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

    const listeners = this.#listeners.get(hookName);
    for (const listener of listeners) {
      // @ts-expect-error -- callback can by any hook type (due to coming from the map), args is the args of a specific hook. Too hard to type properly.
      const out = listener.callback(...args);

      if (out && 'then' in out) {
        throw new Error(
          `${listener.listenerName ? `Listener ${listener.listenerName}` : `An unnamed listener`} of hook ${String(hookName)} on ${getName(this.#eventTarget)} returned a Promise, but the hook is synchronous.`,
        );
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

    const listeners = this.#listeners.get(hookName);
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

  /**
   * Registers a listener for a hook.
   *
   * Returns a function that can be called to deregister the listener.
   *
   * @param hookName
   * @param listener
   * @param listenerName
   */
  addListener<HookName extends keyof HookConfig>(
    hookName: HookName,
    listener: HookConfig[HookName],
    listenerName?: string,
  ): () => void {
    this.#assertValidHookName(hookName);

    if (listenerName) {
      const existingListener = this.#getNamedListener(hookName, listenerName);

      if (existingListener) {
        throw new Error(
          `Named listener ${listenerName} already exists for hook ${String(hookName)} on ${getName(this.#eventTarget)}.`,
        );
      }
    }

    this.#listeners.append(hookName, { callback: listener, listenerName });

    return () => {
      this.removeListener(hookName, listenerName || listener);
    };
  }

  addListeners(listeners: {
    [Key in keyof HookConfig]?: AllowArray<
      HookConfig[Key] | { name: string | symbol; callback: HookConfig[Key] }
    >;
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
      throw new Error(
        `Target ${getName(this.#eventTarget)} does not support a hook named "${String(hookName)}".`,
      );
    }
  }
}

export class HookHandlerBuilder<HookConfig extends {}> {
  readonly #validHookNames: Array<keyof HookConfig>;
  readonly #hookHandlers = new WeakMap<object, HookHandler<HookConfig>>();
  readonly #onRunHook: OnRunHook<HookConfig> | undefined;

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

export interface NewHookable<HookNames extends string> {
  /**
   * Controls which hooks should be run.
   *
   * Possible values:
   * - false: All hooks will be run. (default)
   * - true: No hooks will be run.
   * - An array of strings: The hooks listed in the array will not be run.
   * - An object with the "except" property: Only the hooks listed in the array will be run.
   */
  noHooks?: boolean | undefined | readonly HookNames[] | { except: readonly HookNames[] };
}

export function mayRunHook<HookName extends string>(
  hookName: HookName,
  noHooksConfig: NewHookable<HookName>['noHooks'],
): boolean {
  if (!noHooksConfig) {
    return true;
  }

  if (noHooksConfig === true) {
    return false;
  }

  if ('except' in noHooksConfig) {
    return noHooksConfig.except.includes(hookName);
  }

  return !noHooksConfig.includes(hookName);
}
