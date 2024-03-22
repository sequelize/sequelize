import type { HookHandler, HookHandlerBuilder } from './hooks.js';
import { hooksReworked } from './utils/deprecations.js';

// TODO: delete this in Sequelize v8

export interface LegacyRunHookFunction<HookConfig extends {}, Return> {
  <HookName extends keyof HookConfig>(
    hookName: HookName,
    ...args: HookConfig[HookName] extends (...args2: any) => any
      ? Parameters<HookConfig[HookName]>
      : never
  ): Return;
}

export function legacyBuildRunHook<HookConfig extends {}>(
  // added for typing purposes
  _hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
): LegacyRunHookFunction<HookConfig, void> {
  return async function runHooks<HookName extends keyof HookConfig>(
    this: { hooks: HookHandler<HookConfig> },
    hookName: HookName,
    ...args: HookConfig[HookName] extends (...args2: any) => any
      ? Parameters<HookConfig[HookName]>
      : never
  ): Promise<void> {
    hooksReworked();

    return this.hooks.runAsync(hookName, ...args);
  };
}

export interface LegacyAddAnyHookFunction<HookConfig extends {}> {
  /**
   * Adds a hook listener
   */
  <This, HookName extends keyof HookConfig>(
    this: This,
    hookName: HookName,
    hook: HookConfig[HookName],
  ): This;

  /**
   * Adds a hook listener
   *
   * @param listenerName Provide a name for the hook function. It can be used to remove the hook later.
   */
  <This, HookName extends keyof HookConfig>(
    this: This,
    hookName: HookName,
    listenerName: string,
    hook: HookConfig[HookName],
  ): This;
}

export function legacyBuildAddAnyHook<HookConfig extends {}>(
  // added for typing purposes
  _hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
): LegacyAddAnyHookFunction<HookConfig> {
  return function addHook<
    This extends { hooks: HookHandler<HookConfig> },
    HookName extends keyof HookConfig,
  >(
    this: This,
    hookName: HookName,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): This {
    hooksReworked();

    if (hook) {
      // TODO: remove this eslint-disable once we drop support for TypeScript 5.1
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- In TypeScript 5.1, this is valid. In all other versions, this is not.
      this.hooks.addListener(hookName, hook, listenerNameOrHook);
    } else {
      // @ts-expect-error -- TypeScript struggles with the multiple possible signatures of addListener
      this.hooks.addListener(hookName, listenerNameOrHook);
    }

    return this;
  };
}

export interface LegacyAddHookFunction<Fn> {
  /**
   * Adds a hook listener
   */
  <This extends object>(this: This, hook: Fn): This;

  /**
   * Adds a hook listener
   *
   * @param listenerName Provide a name for the hook function. It can be used to remove the hook later.
   */
  <This extends object>(this: This, listenerName: string, hook: Fn): This;
}

export function legacyBuildAddHook<HookConfig extends {}, HookName extends keyof HookConfig>(
  hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
  hookName: HookName,
): LegacyAddHookFunction<HookConfig[HookName]> {
  return function addHook<This extends { hooks: HookHandler<HookConfig> }>(
    this: This,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): This {
    hooksReworked();

    if (hook) {
      // TODO: remove this eslint-disable once we drop support for TypeScript 5.1
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- In TypeScript 5.1, this is valid. In all other versions, this is not.
      this.hooks.addListener(hookName, hook, listenerNameOrHook);
    } else {
      // @ts-expect-error -- TypeScript struggles with the multiple possible signatures of addListener
      this.hooks.addListener(hookName, listenerNameOrHook);
    }

    return this;
  };
}

export function legacyBuildHasHook<HookConfig extends {}>(
  // added for typing purposes
  _hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
) {
  return function hasHook<HookName extends keyof HookConfig>(
    this: { hooks: HookHandler<HookConfig> },
    hookName: HookName,
  ): boolean {
    hooksReworked();

    return this.hooks.hasListeners(hookName);
  };
}

export function legacyBuildRemoveHook<HookConfig extends {}>(
  // added for typing purposes
  _hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
) {
  return function removeHook<HookName extends keyof HookConfig>(
    this: { hooks: HookHandler<HookConfig> },
    hookName: HookName,
    listenerNameOrListener: HookConfig[HookName] | string,
  ): void {
    hooksReworked();

    return this.hooks.removeListener(hookName, listenerNameOrListener);
  };
}
