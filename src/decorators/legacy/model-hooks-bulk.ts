import type { HookDecoratorArgs, HookOptions } from './hook-decorators.js';
import { implementHookDecorator } from './hook-decorators.js';

export function BeforeBulkCreate(target: Object, propertyName: string): void;
export function BeforeBulkCreate(options: HookOptions): MethodDecorator;
export function BeforeBulkCreate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeBulkCreate', args);
}

export function AfterBulkCreate(target: Object, propertyName: string): void;
export function AfterBulkCreate(options: HookOptions): MethodDecorator;
export function AfterBulkCreate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterBulkCreate', args);
}

export function BeforeBulkDestroy(target: Object, propertyName: string): void;
export function BeforeBulkDestroy(options: HookOptions): MethodDecorator;
export function BeforeBulkDestroy(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeBulkDestroy', args);
}

export function AfterBulkDestroy(target: Object, propertyName: string): void;
export function AfterBulkDestroy(options: HookOptions): MethodDecorator;
export function AfterBulkDestroy(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterBulkDestroy', args);
}

export function BeforeBulkRestore(target: Object, propertyName: string): void;
export function BeforeBulkRestore(options: HookOptions): MethodDecorator;
export function BeforeBulkRestore(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeBulkRestore' as any, args);
}

export function AfterBulkRestore(target: Object, propertyName: string): void;
export function AfterBulkRestore(options: HookOptions): MethodDecorator;
export function AfterBulkRestore(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterBulkRestore' as any, args);
}

export function BeforeBulkUpdate(target: Object, propertyName: string): void;
export function BeforeBulkUpdate(options: HookOptions): MethodDecorator;
export function BeforeBulkUpdate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('beforeBulkUpdate', args);
}

export function AfterBulkUpdate(target: Object, propertyName: string): void;
export function AfterBulkUpdate(options: HookOptions): MethodDecorator;
export function AfterBulkUpdate(...args: HookDecoratorArgs): undefined | MethodDecorator {
  return implementHookDecorator('afterBulkUpdate', args);
}
