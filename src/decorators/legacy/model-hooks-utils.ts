import upperFirst from 'lodash/upperFirst';
import type { ModelHooks } from '../../model-typescript.js';
import { Model } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import {
  createOptionallyParameterizedPropertyDecorator, throwMustBeMethod,
  throwMustBeModel,
  throwMustBeStaticProperty,
} from './decorator-utils.js';

export interface HookOptions {
  name?: string;
}

/**
 * Implementation for hook decorator functions. These are polymorphic. When
 * called with a single argument (IHookOptions) they return a decorator
 * factory function. When called with multiple arguments, they add the hook
 * to the model’s metadata.
 *
 * @param hookType The type of hook
 */
export function createHookDecorator(hookType: keyof ModelHooks) {
  return createOptionallyParameterizedPropertyDecorator<HookOptions | undefined>(
    upperFirst(hookType),
    undefined,
    (args: HookOptions | undefined, target, propertyName) => {
      addHook(target, propertyName, hookType, args);
    },
  );
}

function addHook(
  targetModel: Object,
  methodName: string | symbol,
  hookType: keyof ModelHooks,
  options?: HookOptions,
): void {
  if (typeof targetModel !== 'function') {
    throwMustBeStaticProperty(upperFirst(hookType), targetModel, methodName);
  }

  if (!isModelStatic(targetModel)) {
    throwMustBeModel(upperFirst(hookType), targetModel, methodName);
  }

  // @ts-expect-error -- implicit any, no way around it
  const targetMethod: unknown = targetModel[methodName];
  if (typeof targetMethod !== 'function') {
    throwMustBeMethod(upperFirst(hookType), targetModel, methodName);
  }

  if (methodName in Model) {
    throw new Error(
      `Decorator @${upperFirst(hookType)} has been used on "${targetModel.name}.${String(methodName)}", but method ${JSON.stringify(methodName)} already exists on the base Model class and replacing it can lead to issues.`,
    );
  }

  targetModel.hooks.addListener(hookType, targetMethod.bind(targetModel), options?.name);
}
