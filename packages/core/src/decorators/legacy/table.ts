import type { ModelOptions, Model, ModelStatic } from '../../model.js';
import { registerModelOptions } from '../shared/model.js';

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
