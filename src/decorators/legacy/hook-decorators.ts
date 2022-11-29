import upperFirst from 'lodash/upperFirst';
import type { ModelHooks } from '../../model-typescript.js';
import { Model } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';

export interface HookOptions {
  name?: string;
}

export type HookDecoratorArgs = [targetOrOptions: Object | HookOptions, propertyName?: string | symbol];

/**
 * Implementation for hook decorator functions. These are polymorphic. When
 * called with a single argument (IHookOptions) they return a decorator
 * factory function. When called with multiple arguments, they add the hook
 * to the model’s metadata.
 *
 * @param hookType
 * @param args
 */
export function implementHookDecorator(
  hookType: keyof ModelHooks,
  args: HookDecoratorArgs,
): MethodDecorator | undefined {
  if (args.length === 1) {
    const options: HookOptions = args[0];

    return (target: Object, propertyName: string | symbol) => {
      addHook(target, propertyName, hookType, options);
    };
  }

  const target = args[0];
  const propertyName = args[1]!;

  addHook(target, propertyName, hookType);

  // eslint-disable-next-line consistent-return
  return undefined;
}

function addHook(
  targetModel: Object,
  methodName: string | symbol,
  hookType: keyof ModelHooks,
  options?: HookOptions,
): void {
  if (typeof targetModel !== 'function') {
    throw new TypeError(
      `Decorator @${upperFirst(hookType)} has been used on method "${targetModel.constructor.name}.${String(methodName)}" which is not static. Only static methods can be used for hooks.`,
    );
  }

  if (!isModelStatic(targetModel)) {
    throw new TypeError(
      `Decorator @${upperFirst(hookType)} has been used on "${targetModel.name}.${String(methodName)}", but class "${targetModel.name}" does not extend Model. Hook decorators can only be used on models.`,
    );
  }

  // @ts-expect-error
  const targetMethod: unknown = targetModel[methodName];
  if (typeof targetMethod !== 'function') {
    throw new TypeError(
      `Decorator @${upperFirst(hookType)} has been used on "${targetModel.name}.${String(methodName)}", which is not a method.`,
    );
  }

  if (methodName in Model) {
    throw new Error(
      `Decorator @${upperFirst(hookType)} has been used on "${targetModel.name}.${String(methodName)}", but method ${JSON.stringify(methodName)} already exists on the base Model class and replacing it can lead to issues.`,
    );
  }

  targetModel.hooks.addListener(hookType, targetMethod.bind(targetModel), options?.name);
}
