import _ from 'lodash';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class SequelizeMethod {}

export class Fn extends SequelizeMethod {
  private fn: string;
  private args: unknown[];

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
  private col: string[];

  constructor(col: string[], ...args: string[]) {
    super();
    if (args.length > 0) {
      col = args;
    }
    this.col = col;
  }
}

export class Cast extends SequelizeMethod {
  private val: any;
  private type: string;
  private json: boolean;

  constructor(val: any, type: string, json: boolean) {
    super();
    this.val = val;
    this.type = (type || '').trim();
    this.json = json || false;
  }
}

export class Literal extends SequelizeMethod {
  private val: any;

  constructor(val: any) {
    super();
    this.val = val;
  }
}

export class Json extends SequelizeMethod {
  private conditions?: { [key: string]: any };
  private path?: string;
  private value?: any;

  constructor(
    conditionsOrPath: { [key: string]: any } | string,
    value: string
  ) {
    super();

    const isPathString = typeof conditionsOrPath === 'string';

    if (!isPathString && _.isObject(conditionsOrPath)) {
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
  private attribute: any;
  private comparator: any;
  private logic: any;

  constructor(attribute: AttributeType, comparator: string | symbol, logic: LogicType);
  constructor(attribute: AttributeType, logic: LogicType);
  constructor(attribute: any, comparatorOrLogic: string | symbol | LogicType, logic: LogicType | undefined) {
    super();

    if (logic === undefined) {
      logic = comparator;
      comparator = '=';
    }

    this.attribute = attribute;
    this.comparator = comparator;
    this.logic = logic;
  }
}
