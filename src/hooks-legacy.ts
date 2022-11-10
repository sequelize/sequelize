import type { HookHandlerBuilder } from './hooks.js';
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
  hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
): LegacyRunHookFunction<HookConfig, void> {

  return async function runHooks<HookName extends keyof HookConfig>(
    this: object,
    hookName: HookName,
    ...args: HookConfig[HookName] extends (...args2: any) => any
      ? Parameters<HookConfig[HookName]>
      : never
  ): Promise<void> {
    hooksReworked();

    return hookHandlerBuilder.getFor(this).runAsync(hookName, ...args);
  };
}

export interface LegacyAddAnyHookFunction<HookConfig extends {}> {
  /**
   * Adds a hook listener
   */
  <This, HookName extends keyof HookConfig>(this: This, hookName: HookName, hook: HookConfig[HookName]): This;

  /**
   * Adds a hook listener
   *
   * @param listenerName Provide a name for the hook function. It can be used to remove the hook later.
   */
  <This, HookName extends keyof HookConfig>(
      this: This,
      hookName: HookName,
      listenerName: string,
      hook: HookConfig[HookName]
  ): This;
}

export function legacyBuildAddAnyHook<HookConfig extends {}>(
  hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
): LegacyAddAnyHookFunction<HookConfig> {

  return function addHook<This extends object, HookName extends keyof HookConfig>(
    this: This,
    hookName: HookName,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): This {
    hooksReworked();

    if (hook) {
      // @ts-expect-error
      hookHandlerBuilder.getFor(this).addListener(hookName, hook, listenerNameOrHook);
    } else {
      // @ts-expect-error
      hookHandlerBuilder.getFor(this).addListener(hookName, listenerNameOrHook);
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
  return function addHook<This extends object>(
    this: This,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): This {
    hooksReworked();

    if (hook) {
      // @ts-expect-error
      hookHandlerBuilder.getFor(this).addListener(hookName, hook, listenerNameOrHook);
    } else {
      // @ts-expect-error
      return hookHandlerBuilder.getFor(this).addListener(hookName, listenerNameOrHook);
    }

    return this;
  };
}

export function legacyBuildHasHook<HookConfig extends {}>(hookHandlerBuilder: HookHandlerBuilder<HookConfig>) {
  return function hasHook<HookName extends keyof HookConfig>(this: object, hookName: HookName): boolean {
    hooksReworked();

    return hookHandlerBuilder.getFor(this).hasListeners(hookName);
  };
}

export function legacyBuildRemoveHook<HookConfig extends {}>(hookHandlerBuilder: HookHandlerBuilder<HookConfig>) {
  return function removeHook<HookName extends keyof HookConfig>(
    this: object,
    hookName: HookName,
    listenerNameOrListener: HookConfig[HookName] | string,
  ): void {
    hooksReworked();

    return hookHandlerBuilder.getFor(this).removeListener(hookName, listenerNameOrListener);
  };
}
