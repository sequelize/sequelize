/**
 * Quote helpers implement quote ability for all dialects.
 * These are basic block of query building
 *
 * Its better to implement all dialect implementation together here. Which will allow
 * even abstract generator to use them by just specifying dialect type.
 *
 * Defining these helpers in each query dialect will leave
 * code in dual dependency of abstract <-> specific dialect
 */

'use strict';

const Utils = require('../../../../utils');

