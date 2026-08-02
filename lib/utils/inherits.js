import { inherits as nodeInherits } from 'node:util';
import _ from 'lodash';

/**
 * like util.inherits, but also copies over static properties
 * @private
 */
export function inherits(constructor, superConstructor) {
  nodeInherits(constructor, superConstructor); // Instance (prototype) methods
  _.extend(constructor, superConstructor); // Static methods
}

export default inherits;
