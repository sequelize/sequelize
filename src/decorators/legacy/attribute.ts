import { isDataType } from '../../dialects/abstract/data-types-utils.js';
import type { DataType } from '../../dialects/abstract/data-types.js';
import type { ModelAttributeColumnOptions, ModelStatic } from '../../model.js';
import { Model } from '../../model.js';
import { columnToAttribute } from '../../utils/deprecations.js';
import { registerModelAttributeOptions } from '../shared/model.js';

export function Attribute(optionsOrDataType: DataType | ModelAttributeColumnOptions): PropertyDecorator {
  return (target: Object, propertyName: string | symbol, propertyDescriptor?: PropertyDescriptor) => {
    if (typeof propertyName === 'symbol') {
      throw new TypeError('Symbol Model Attributes are not currently supported. We welcome a PR that implements this feature.');
    }

    annotate(
      target,
      propertyName,
      propertyDescriptor ?? Object.getOwnPropertyDescriptor(target, propertyName),
      optionsOrDataType,
    );
  };
}

/**
 * @param optionsOrDataType
 * @deprecated use {@link Attribute} instead.
 */
export function Column(optionsOrDataType: DataType | ModelAttributeColumnOptions): PropertyDecorator {
  columnToAttribute();

  return Attribute(optionsOrDataType);
}

function annotate(
  target: Object,
  propertyName: string,
  propertyDescriptor: PropertyDescriptor | undefined,
  optionsOrDataType: ModelAttributeColumnOptions | DataType,
): void {
  if (typeof target === 'function') {
    throw new TypeError(
      `Decorator @Attribute has been used on "${target.name}.${String(propertyName)}", which is static. This decorator can only be used on instance properties, setters and getters.`,
    );
  }

  if (!(target instanceof Model)) {
    throw new TypeError(
      `Decorator @Attribute has been used on "${target.constructor.name}.${String(propertyName)}", but class "${target.constructor.name}" does not extend Model. This decorator can only be used on models.`,
    );
  }

  let options: ModelAttributeColumnOptions;

  if (isDataType(optionsOrDataType)) {
    options = {
      type: optionsOrDataType,
    };
  } else {
    options = { ...optionsOrDataType };
  }

  if (!options.type) {
    throw new Error(`Decorator @Attribute has been used on "${target.constructor.name}.${String(propertyName)}" but does not specify the data type of the attribute. Please specify a data type.`);
  }

  if (propertyDescriptor) {
    if (propertyDescriptor.get) {
      options.get = propertyDescriptor.get;
    }

    if (propertyDescriptor.set) {
      options.set = propertyDescriptor.set;
    }
  }

  registerModelAttributeOptions(target.constructor as ModelStatic, propertyName, options);
}
