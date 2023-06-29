import type { ModelOptions, Model, ModelStatic } from '../../model.js';
import { registerModelOptions } from '../shared/model.js';

/**
 * The `@Table` decorator is used to configure a model. It is used on a model class, and takes an object as parameter.<br />
 * Using this decorator is completely optional, you only need to use it if you want to configure one of the options of your model.
 *
 * @example
 * ```ts
 * @Table({
 *   tableName: 'users',
 *   timestamps: false,
 * })
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {}
 * ```
 *
 * @param options
 */
export function Table<M extends Model = Model>(options: ModelOptions<M>): ClassDecorator;
export function Table(target: ModelStatic): void;
export function Table(arg: any): undefined | ClassDecorator {
  if (typeof arg === 'function') {
    annotate(arg);

    return undefined;
  }

  const options: ModelOptions = { ...arg };

  return (target: any) => annotate(target, options);
}

function annotate(target: ModelStatic, options: ModelOptions = {}): void {
  registerModelOptions(target, options);
}
