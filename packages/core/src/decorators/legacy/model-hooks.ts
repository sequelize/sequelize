import upperFirst from 'lodash/upperFirst.js';
import type { ModelHooks } from '../../model-hooks.js';
import { Model } from '../../model.js';
import { isModelStatic } from '../../utils/model-utils.js';
import { registerModelOptions } from '../shared/model.js';
import {
  createOptionallyParameterizedPropertyDecorator,
  throwMustBeMethod,
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
function createHookDecorator(hookType: keyof ModelHooks) {
  return createOptionallyParameterizedPropertyDecorator<HookOptions | undefined>(
    upperFirst(hookType),
    undefined,
    (options: HookOptions | undefined, targetModel, methodName) => {
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

      const callback = targetMethod.bind(targetModel);

      registerModelOptions(targetModel, {
        hooks: {
          [hookType]: options?.name ? { name: options?.name, callback } : callback,
        },
      });
    },
  );
}

export const BeforeBulkCreate = createHookDecorator('beforeBulkCreate');
export const AfterBulkCreate = createHookDecorator('afterBulkCreate');

export const BeforeBulkDestroy = createHookDecorator('beforeBulkDestroy');
export const AfterBulkDestroy = createHookDecorator('afterBulkDestroy');

export const BeforeBulkRestore = createHookDecorator('beforeBulkRestore');
export const AfterBulkRestore = createHookDecorator('afterBulkRestore');

export const BeforeBulkUpdate = createHookDecorator('beforeBulkUpdate');
export const AfterBulkUpdate = createHookDecorator('afterBulkUpdate');

export const BeforeAssociate = createHookDecorator('beforeAssociate');
export const AfterAssociate = createHookDecorator('afterAssociate');

export const BeforeCount = createHookDecorator('beforeCount');

export const BeforeCreate = createHookDecorator('beforeCreate');
export const AfterCreate = createHookDecorator('afterCreate');

export const BeforeDestroy = createHookDecorator('beforeDestroy');
export const AfterDestroy = createHookDecorator('afterDestroy');

export const BeforeDestroyMany = createHookDecorator('beforeDestroyMany');
export const AfterDestroyMany = createHookDecorator('afterDestroyMany');

export const BeforeFind = createHookDecorator('beforeFind');
export const BeforeFindAfterExpandIncludeAll = createHookDecorator(
  'beforeFindAfterExpandIncludeAll',
);
export const BeforeFindAfterOptions = createHookDecorator('beforeFindAfterOptions');
export const AfterFind = createHookDecorator('afterFind');

export const BeforeRestore = createHookDecorator('beforeRestore');
export const AfterRestore = createHookDecorator('afterRestore');

export const BeforeSave = createHookDecorator('beforeSave');
export const AfterSave = createHookDecorator('afterSave');

export const BeforeSync = createHookDecorator('beforeSync');
export const AfterSync = createHookDecorator('afterSync');

export const BeforeUpdate = createHookDecorator('beforeUpdate');
export const AfterUpdate = createHookDecorator('afterUpdate');

export const BeforeUpsert = createHookDecorator('beforeUpsert');
export const AfterUpsert = createHookDecorator('afterUpsert');

export const BeforeValidate = createHookDecorator('beforeValidate');
export const AfterValidate = createHookDecorator('afterValidate');
export const ValidationFailed = createHookDecorator('validationFailed');

export const BeforeDefinitionRefresh = createHookDecorator('beforeDefinitionRefresh');
export const AfterDefinitionRefresh = createHookDecorator('afterDefinitionRefresh');
