import type { HookOptions, HookDecoratorArgs } from './hook-decorators.js';
import { implementHookDecorator } from './hook-decorators.js';

export function BeforeAssociate(target: Object, propertyName: string): void;
export function BeforeAssociate(options: HookOptions): MethodDecorator;
export function BeforeAssociate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeAssociate', args);
}

export function AfterAssociate(target: Object, propertyName: string): void;
export function AfterAssociate(options: HookOptions): MethodDecorator;
export function AfterAssociate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterAssociate', args);
}

export function BeforeCount(target: Object, propertyName: string): void;
export function BeforeCount(options: HookOptions): MethodDecorator;
export function BeforeCount(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeCount', args);
}

export function BeforeCreate(target: Object, propertyName: string): void;
export function BeforeCreate(options: HookOptions): MethodDecorator;
export function BeforeCreate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeCreate', args);
}

export function AfterCreate(target: Object, propertyName: string): void;
export function AfterCreate(options: HookOptions): MethodDecorator;
export function AfterCreate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterCreate', args);
}

export function BeforeDestroy(target: Object, propertyName: string): void;
export function BeforeDestroy(options: HookOptions): MethodDecorator;
export function BeforeDestroy(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeDestroy', args);
}

export function AfterDestroy(target: Object, propertyName: string): void;
export function AfterDestroy(options: HookOptions): MethodDecorator;
export function AfterDestroy(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterDestroy', args);
}

export function BeforeFind(target: Object, propertyName: string): void;
export function BeforeFind(options: HookOptions): MethodDecorator;
export function BeforeFind(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeFind', args);
}

export function BeforeFindAfterExpandIncludeAll(target: Object, propertyName: string): void;
export function BeforeFindAfterExpandIncludeAll(options: HookOptions): MethodDecorator;
export function BeforeFindAfterExpandIncludeAll(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeFindAfterExpandIncludeAll', args);
}

export function BeforeFindAfterOptions(target: Object, propertyName: string): void;
export function BeforeFindAfterOptions(options: HookOptions): MethodDecorator;
export function BeforeFindAfterOptions(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeFindAfterOptions', args);
}

export function AfterFind(target: Object, propertyName: string): void;
export function AfterFind(options: HookOptions): MethodDecorator;
export function AfterFind(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterFind', args);
}

export function BeforeRestore(target: Object, propertyName: string): void;
export function BeforeRestore(options: HookOptions): MethodDecorator;
export function BeforeRestore(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeRestore' as any, args);
}

export function AfterRestore(target: Object, propertyName: string): void;
export function AfterRestore(options: HookOptions): MethodDecorator;
export function AfterRestore(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterRestore' as any, args);
}

export function BeforeSave(target: Object, propertyName: string): void;
export function BeforeSave(options: HookOptions): MethodDecorator;
export function BeforeSave(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeSave' as any, args);
}

export function AfterSave(target: Object, propertyName: string): void;
export function AfterSave(options: HookOptions): MethodDecorator;
export function AfterSave(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterSave' as any, args);
}

export function BeforeSync(target: Object, propertyName: string): void;
export function BeforeSync(options: HookOptions): MethodDecorator;
export function BeforeSync(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeSync', args);
}

export function AfterSync(target: Object, propertyName: string): void;
export function AfterSync(options: HookOptions): MethodDecorator;
export function AfterSync(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterSync', args);
}

export function BeforeUpdate(target: Object, propertyName: string): void;
export function BeforeUpdate(options: HookOptions): MethodDecorator;
export function BeforeUpdate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeUpdate', args);
}

export function AfterUpdate(target: Object, propertyName: string): void;
export function AfterUpdate(options: HookOptions): MethodDecorator;
export function AfterUpdate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterUpdate', args);
}

export function BeforeUpsert(target: Object, propertyName: string): void;
export function BeforeUpsert(options: HookOptions): MethodDecorator;
export function BeforeUpsert(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeUpsert' as any, args);
}

export function AfterUpsert(target: Object, propertyName: string): void;
export function AfterUpsert(options: HookOptions): MethodDecorator;
export function AfterUpsert(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterUpsert' as any, args);
}

export function BeforeValidate(target: Object, propertyName: string): void;
export function BeforeValidate(options: HookOptions): MethodDecorator;
export function BeforeValidate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeValidate', args);
}

export function ValidationFailed(target: Object, propertyName: string): void;
export function ValidationFailed(options: HookOptions): MethodDecorator;
export function ValidationFailed(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('validationFailed' as any, args);
}

export function AfterValidate(target: Object, propertyName: string): void;
export function AfterValidate(options: HookOptions): MethodDecorator;
export function AfterValidate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterValidate', args);
}
