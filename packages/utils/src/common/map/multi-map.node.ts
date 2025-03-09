import NodeUtil, { type InspectOptions } from 'node:util';
import { pojo } from '../pojo.js';
import { MultiMap } from './multi-map.js';

// @ts-expect-error -- this node-specific extension is not declared on base class
MultiMap.prototype[NodeUtil.inspect.custom] = function inspect(
  depth: number,
  options: InspectOptions,
): string {
  const newOptions = Object.assign(pojo(), options, {
    depth: options.depth == null ? null : options.depth - 1,
  });

  return NodeUtil.inspect(new Map(this), newOptions).replace(/^Map/, 'MultiMap');
};

export { MultiMap } from './multi-map.js';
