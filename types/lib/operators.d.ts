/**
 * object that holds all operator symbols
 */
declare const Op: {
  readonly adjacent: unique symbol;
  readonly all: unique symbol;
  readonly and: unique symbol;
  readonly any: unique symbol;
  readonly between: unique symbol;
  readonly col: unique symbol;
  readonly contained: unique symbol;
  readonly contains: unique symbol;
  readonly endsWith: unique symbol;
  readonly eq: unique symbol;
  readonly gt: unique symbol;
  readonly gte: unique symbol;
  readonly iLike: unique symbol;
  readonly in: unique symbol;
  readonly iRegexp: unique symbol;
  readonly is: unique symbol;
  readonly like: unique symbol;
  readonly lt: unique symbol;
  readonly lte: unique symbol;
  readonly ne: unique symbol;
  readonly noExtendLeft: unique symbol;
  readonly noExtendRight: unique symbol;
  readonly not: unique symbol;
  readonly notBetween: unique symbol;
  readonly notILike: unique symbol;
  readonly notIn: unique symbol;
  readonly notIRegexp: unique symbol;
  readonly notLike: unique symbol;
  readonly notRegexp: unique symbol;
  readonly or: unique symbol;
  readonly overlap: unique symbol;
  readonly placeholder: unique symbol;
  readonly regexp: unique symbol;
  readonly startsWith: unique symbol;
  readonly strictLeft: unique symbol;
  readonly strictRight: unique symbol;
  readonly substring: unique symbol;
};
export = Op;
