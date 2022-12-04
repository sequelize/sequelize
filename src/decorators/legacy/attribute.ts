import { isDataType } from '../../dialects/abstract/data-types-utils.js';
import type { DataType } from '../../dialects/abstract/data-types.js';
import type { ModelAttributeColumnOptions } from '../../model.js';
import { columnToAttribute } from '../../utils/deprecations.js';
import { createOptionalAttributeOptionsDecorator, createRequiredAttributeOptionsDecorator } from './attribute-utils.js';
import type { PropertyOrGetterDescriptor } from './decorator-utils.js';

type AttributeDecoratorOption = DataType | Partial<ModelAttributeColumnOptions>;

export const Attribute = createRequiredAttributeOptionsDecorator<AttributeDecoratorOption>('Attribute', attrOptionOrDataType => {
  if (isDataType(attrOptionOrDataType)) {
    return {
      type: attrOptionOrDataType,
    };
  }

  return attrOptionOrDataType;
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
 * Configures the unique option of the attribute.
 */
export const Unique = createOptionalAttributeOptionsDecorator<UniqueOptions>('Unique', true, (unique: UniqueOptions) => ({ unique }));

/**
 * Makes the attribute accept null values. Opposite of {@link NotNull}.
 */
export const AllowNull = createOptionalAttributeOptionsDecorator<boolean>('AllowNull', true, (allowNull: boolean) => ({ allowNull }));

/**
 * Makes the attribute reject null values. Opposite of {@link AllowNull}.
 */
export const NotNull = createOptionalAttributeOptionsDecorator<boolean>('NotNull', true, (notNull: boolean) => ({ allowNull: !notNull }));

export const AutoIncrement = createOptionalAttributeOptionsDecorator<boolean>('AutoIncrement', true, (autoIncrement: boolean) => ({ autoIncrement }));

export const PrimaryKey = createOptionalAttributeOptionsDecorator<boolean>('PrimaryKey', true, (primaryKey: boolean) => ({ primaryKey }));

export const Comment = createRequiredAttributeOptionsDecorator<string>('Comment', (comment: string) => ({ comment }));

export const Default = createRequiredAttributeOptionsDecorator<unknown>('Default', (defaultValue: unknown) => ({ defaultValue }));

/**
 * Sets the name of the column (in the database) this attribute maps to.
 */
export const ColumnName = createRequiredAttributeOptionsDecorator<string>('ColumnName', (columnName: string) => ({ field: columnName }));
