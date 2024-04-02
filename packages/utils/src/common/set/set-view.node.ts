import NodeUtil, { type InspectOptions } from 'node:util';
import { pojo } from '../pojo.js';
import { SetView } from './set-view.js';

// @ts-expect-error -- This node-specific extension is not declared on the base class.
SetView.prototype[NodeUtil.inspect.custom] = function inspect(
  depth: number,
  options: InspectOptions,
): string {
  const newOptions = Object.assign(pojo(), options, {
    depth: options.depth == null ? null : options.depth - 1,
  });

  return NodeUtil.inspect(this.toMutableSet(), newOptions).replace(/^Set/, 'SetView');
};

export { SetView } from './set-view.js';
