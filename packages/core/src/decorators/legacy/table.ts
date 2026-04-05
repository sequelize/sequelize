import type { Model, ModelOptions, ModelStatic } from '../../model.js';
import type { RegisteredModelOptions } from '../shared/model.js';
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

  // @ts-expect-error -- making sure the option is not provided.
  if (options.abstract) {
    throw new Error(
      '`abstract` is not a valid option for @Table. Did you mean to use @Table.Abstract?',
    );
  }

  return (target: any) => annotate(target, options);
}

function AbstractTable<M extends Model = Model>(
  options: Omit<ModelOptions<M>, 'tableName' | 'name'>,
): ClassDecorator;
function AbstractTable(target: ModelStatic): void;
function AbstractTable(arg: any): undefined | ClassDecorator {
  if (typeof arg === 'function') {
    annotate(arg, { abstract: true });

    return undefined;
  }

  const options: ModelOptions = { ...arg, abstract: true };

  if (options.tableName || options.name) {
    throw new Error('Options "tableName" and "name" cannot be set on abstract models.');
  }

  return (target: any) => annotate(target, options);
}

Table.Abstract = AbstractTable;

function annotate(target: ModelStatic, options: RegisteredModelOptions = {}): void {
  registerModelOptions(target, options);
}
