import NodeUtil, { type InspectOptions } from 'node:util';
import { pojo } from '../pojo.js';
import { MapView } from './map-view.js';

// @ts-expect-error -- this node-specific extension is not declared on base class
MapView.prototype[NodeUtil.inspect.custom] = function inspect(
  depth: number,
  options: InspectOptions,
): string {
  const newOptions = Object.assign(pojo(), options, {
    depth: options.depth == null ? null : options.depth - 1,
  });

  return NodeUtil.inspect(this.toMutableMap(), newOptions).replace(/^Map/, 'MapView');
};

export { MapView } from './map-view.js';
