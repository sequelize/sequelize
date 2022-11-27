import { isDataType } from '../../dialects/abstract/data-types-utils.js';
import type { DataType } from '../../dialects/abstract/data-types.js';
import type { ModelAttributeColumnOptions, ModelStatic } from '../../model.js';
import { Model } from '../../model.js';
import { columnToAttribute } from '../../utils/deprecations.js';
import { registerModelAttributeOptions } from '../shared/model.js';
import type { PropertyOrGetterDescriptor } from './legacy-decorator-utils.js';
import { makeParameterizedPropertyDecorator } from './legacy-decorator-utils.js';

type AttributeDecoratorOption = DataType | Partial<ModelAttributeColumnOptions> | undefined;

export const Attribute = makeParameterizedPropertyDecorator<AttributeDecoratorOption>(undefined, (
  option: AttributeDecoratorOption,
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor?: PropertyDescriptor,
) => {
  if (!option) {
    throw new Error('Decorator @Attribute requires an argument');
  }

  annotate(target, propertyName, propertyDescriptor, option);
});

/**
 * @param optionsOrDataType
 * @deprecated use {@link Attribute} instead.
 */
export function Column(optionsOrDataType: DataType | ModelAttributeColumnOptions): PropertyOrGetterDescriptor {
  columnToAttribute();

  return Attribute(optionsOrDataType);
}

type UniqueOptions = NonNullable<ModelAttributeColumnOptions['unique']>;

/**
 * Sets the unique option true for annotated property
 */
export const Unique = makeParameterizedPropertyDecorator<UniqueOptions>(true, (
  option: UniqueOptions,
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor?: PropertyDescriptor,
) => {
  annotate(target, propertyName, propertyDescriptor, { unique: option });
});

function annotate(
  target: Object,
  propertyName: string | symbol,
  propertyDescriptor: PropertyDescriptor | undefined,
  optionsOrDataType: Partial<ModelAttributeColumnOptions> | DataType,
): void {
  if (typeof propertyName === 'symbol') {
    throw new TypeError('Symbol Model Attributes are not currently supported. We welcome a PR that implements this feature.');
  }

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

  let options: Partial<ModelAttributeColumnOptions>;

  if (isDataType(optionsOrDataType)) {
    options = {
      type: optionsOrDataType,
    };
  } else {
    options = { ...optionsOrDataType };
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
