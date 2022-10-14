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
    <HookName extends keyof HookConfig>(hookName: string, hook: HookConfig[HookName]): void;

  /**
   * Adds a hook listener
   *
   * @param listenerName Provide a name for the hook function. It can be used to remove the hook later.
   */
    <HookName extends keyof HookConfig>(hookName: string, listenerName: string, hook: HookConfig[HookName]): void;
}

export function legacyBuildAddAnyHook<HookConfig extends {}>(
  hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
): LegacyAddAnyHookFunction<HookConfig> {

  return function addHook<HookName extends keyof HookConfig>(
    this: object,
    hookName: HookName,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): void {
    hooksReworked();

    if (hook) {
      // @ts-expect-error
      return hookHandlerBuilder.getFor(this).addListener(hookName, hook, listenerNameOrHook);
    }

    // @ts-expect-error
    return hookHandlerBuilder.getFor(this).addListener(hookName, listenerNameOrHook);
  };
}

export interface LegacyAddHookFunction<Fn> {
  /**
   * Adds a hook listener
   */
  (hook: Fn): void;

  /**
   * Adds a hook listener
   *
   * @param listenerName Provide a name for the hook function. It can be used to remove the hook later.
   */
  (listenerName: string, hook: Fn): void;
}

export function legacyBuildAddHook<HookConfig extends {}, HookName extends keyof HookConfig>(
  hookHandlerBuilder: HookHandlerBuilder<HookConfig>,
  hookName: HookName,
): LegacyAddHookFunction<HookConfig[HookName]> {
  return function addHook(
    this: object,
    listenerNameOrHook: HookConfig[HookName] | string,
    hook?: HookConfig[HookName],
  ): void {
    hooksReworked();

    if (hook) {
      // @ts-expect-error
      return hookHandlerBuilder.getFor(this).addListener(hookName, hook, listenerNameOrHook);
    }

    // @ts-expect-error
    return hookHandlerBuilder.getFor(this).addListener(hookName, listenerNameOrHook);
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
    listenerName: string,
  ): void {
    hooksReworked();

    return hookHandlerBuilder.getFor(this).removeListener(hookName, listenerName);
  };
}
