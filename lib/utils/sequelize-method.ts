import isObject from 'lodash/isObject';
import type { AttributeType, LogicType } from '../..';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class SequelizeMethod {}

export class Fn extends SequelizeMethod {
  private readonly fn: string;
  private readonly args: unknown[];

  constructor(fn: string, args: unknown[]) {
    super();
    this.fn = fn;
    this.args = args;
  }

  clone() {
    return new Fn(this.fn, this.args);
  }
}

export class Col extends SequelizeMethod {
  private readonly col: string[];

  constructor(col: string[], ...args: string[]) {
    super();
    if (args.length > 0) {
      col = args;
    }

    this.col = col;
  }
}

export class Cast extends SequelizeMethod {
  private readonly val: any;
  private readonly type: string;
  private readonly json: boolean;

  constructor(val: any, type: string, json: boolean) {
    super();
    this.val = val;
    this.type = (type || '').trim();
    this.json = json || false;
  }
}

export class Literal extends SequelizeMethod {
  private readonly val: any;

  constructor(val: any) {
    super();
    this.val = val;
  }
}

export class Json extends SequelizeMethod {
  private readonly conditions?: { [key: string]: any };
  private readonly path?: string;
  private readonly value?: any;

  constructor(
    conditionsOrPath: { [key: string]: any } | string,
    value: string,
  ) {
    super();

    const isPathString = typeof conditionsOrPath === 'string';

    if (!isPathString && isObject(conditionsOrPath)) {
      this.conditions = conditionsOrPath;
    } else if (isPathString) {
      this.path = conditionsOrPath;

      if (value) {
        this.value = value;
      }
    }
  }
}

export class Where extends SequelizeMethod {
  private readonly attribute: any;
  private readonly comparator: any;
  private readonly logic: any;

  constructor(attribute: AttributeType, comparator: string | symbol, logic: LogicType);
  constructor(attribute: AttributeType, logic: LogicType);
  constructor(attribute: AttributeType, comparatorOrLogic: string | symbol | LogicType, logic?: LogicType) {
    super();

    let comparator;

    if (logic === undefined) {
      logic = comparatorOrLogic;
      comparator = '=';
    } else {
      comparator = comparatorOrLogic;
    }

    this.attribute = attribute;
    this.comparator = comparator;
    this.logic = logic;
  }
}
