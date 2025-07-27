import type { NonUndefined } from '@sequelize/utils';
import { isDataType } from '../../abstract-dialect/data-types-utils.js';
import type { DataType } from '../../abstract-dialect/data-types.js';
import type { AttributeIndexOptions, AttributeOptions } from '../../model.js';
import { columnToAttribute } from '../../utils/deprecations.js';
import { underscore } from '../../utils/string.js';
import {
  createOptionalAttributeOptionsDecorator,
  createRequiredAttributeOptionsDecorator,
} from './attribute-utils.js';
import type { PropertyOrGetterDescriptor } from './decorator-utils.js';

export type InheritedAttributeOptions = Partial<AttributeOptions> & {
  /**
   * If true, the attribute will be inserted before the descendant's attributes.
   */
  insertBefore?: boolean;
  /**
   * If true, the attribute will be inserted after the descendant's attributes.
   * This is the default behavior.
   */
  insertAfter?: boolean;
};

type AttributeDecoratorOption = DataType | InheritedAttributeOptions;

/**
 * The `@Attribute` decorator is used to add an attribute to a model. It is used on an instance property.
 *
 * @example
 * The simplest way to use it is to pass a data type as the parameter:
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   declare firstName: string | null;
 * }
 * ```
 *
 * @example
 * `@Attribute` also accepts an option bag, {@link index~AttributeOptions}, which allows you to configure all available attribute definition options.
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute({
 *     type: DataTypes.STRING,
 *     allowNull: false,
 *   })
 *   declare firstName: string;
 * }
 * ```
 */
export const Attribute = createRequiredAttributeOptionsDecorator<AttributeDecoratorOption>(
  'Attribute',
  attrOptionOrDataType => {
    if (isDataType(attrOptionOrDataType)) {
      return {
        type: attrOptionOrDataType,
      };
    }

    if (attrOptionOrDataType.insertBefore && attrOptionOrDataType.insertAfter) {
      throw new Error(
        `Cannot set both 'insertBefore' and 'insertAfter' to true on the same attribute`,
      );
    }

    return attrOptionOrDataType;
  },
);

/**
 * @param optionsOrDataType
 * @deprecated use {@link Attribute} instead.
 */
export function Column(optionsOrDataType: DataType | AttributeOptions): PropertyOrGetterDescriptor {
  columnToAttribute();

  return Attribute(optionsOrDataType);
}

type UniqueOptions = NonNullable<AttributeOptions['unique']>;

/**
 * The `@Unique` decorator is used to make an attribute unique, it is a shortcut for setting the `unique` option of the {@link Attribute} decorator.
 * Learn more about unique constraints in our documentation.
 *
 * @example
 * This makes "firstName" unique
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @Unique
 *   declare firstName: string;
 * }
 * ```
 *
 * @example
 * This creates a composite unique on columns "firstName" and "lastName"
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @Unique('firstName-lastName')
 *   declare firstName: string;
 *
 *   @Attribute(DataTypes.STRING)
 *   @Unique('firstName-lastName')
 *   declare lastName: string;
 * }
 * ```
 */
export const Unique = createOptionalAttributeOptionsDecorator<UniqueOptions>(
  'Unique',
  true,
  (unique: UniqueOptions) => ({ unique }),
);

/**
 * Makes the attribute accept null values. Opposite of {@link NotNull}.
 * It is a shortcut for setting the `allowNull` option of the {@link Attribute} decorator to true.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @AllowNull
 *   declare firstName: string | null;
 * }
 * ```
 */
export const AllowNull = createOptionalAttributeOptionsDecorator<boolean>(
  'AllowNull',
  true,
  (allowNull: boolean) => ({ allowNull }),
);

/**
 * Makes the attribute reject null values. Opposite of {@link AllowNull}.
 * It is a shortcut for setting the `allowNull` option of the {@link Attribute} decorator to false.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @NotNull
 *   declare firstName: string;
 * }
 * ```
 */
export const NotNull = createOptionalAttributeOptionsDecorator<boolean>(
  'NotNull',
  true,
  (notNull: boolean) => ({ allowNull: !notNull }),
);

/**
 * The `@PrimaryKey` decorator is used to make an attribute a primary key,
 * it is a shortcut for setting the `primaryKey` option of the {@link Attribute} decorator to true.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.INTEGER)
 *   @PrimaryKey
 *   declare id: number;
 * }
 * ```
 */
export const PrimaryKey = createOptionalAttributeOptionsDecorator<boolean>(
  'PrimaryKey',
  true,
  (primaryKey: boolean) => ({ primaryKey }),
);

/**
 * The `@AutoIncrement` decorator is used to make an attribute auto-increment,
 * it is a shortcut for setting the `autoIncrement` option of the {@link Attribute} decorator to true.
 *
 * Some dialects require the field to be a primary key.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.INTEGER)
 *   @PrimaryKey
 *   @AutoIncrement
 *   declare id: number;
 * }
 * ```
 */
export const AutoIncrement = createOptionalAttributeOptionsDecorator<boolean>(
  'AutoIncrement',
  true,
  (autoIncrement: boolean) => ({ autoIncrement }),
);

/**
 * The `@Comment` decorator is used to set the comment on a column, it is a shortcut for setting the `comment` option of the {@link Attribute} decorator.
 *
 * This is only useful if you use {@link index~Sequelize#sync} to create your tables.
 */
export const Comment = createRequiredAttributeOptionsDecorator<string>(
  'Comment',
  (comment: string) => ({ comment }),
);

/**
 * The `@Default` decorator is used to set a default value for an attribute, it is a shortcut for setting the `defaultValue` option of the {@link Attribute} decorator.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @Default('John Doe')
 *   declare firstName: string;
 * }
 * ```
 */
export const Default = createRequiredAttributeOptionsDecorator<unknown>(
  'Default',
  (defaultValue: unknown) => ({ defaultValue }),
);

/**
 * Sets the name of the column (in the database) this attribute maps to.
 * It is a shortcut for setting the `columnName` option of the {@link Attribute} decorator.
 *
 * With a good naming strategy configured, you rarely need to use this decorator.
 * Learn about naming strategies in our documentation.
 *
 * @example
 * ```ts
 * class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
 *   @Attribute(DataTypes.STRING)
 *   @ColumnName('first_name')
 *   declare firstName: string;
 * }
 * ```
 */
export const ColumnName = createRequiredAttributeOptionsDecorator<string>(
  'ColumnName',
  (columnName: string) => ({ columnName }),
);

type IndexAttributeOption = NonUndefined<AttributeIndexOptions['attribute']>;

export function createIndexDecorator(
  decoratorName: string,
  options: Omit<AttributeIndexOptions, 'attribute'> = {},
) {
  return createOptionalAttributeOptionsDecorator<IndexAttributeOption>(
    decoratorName,
    {},
    (indexField: IndexAttributeOption): Partial<AttributeOptions> => {
      const index: AttributeIndexOptions = {
        ...options,
        // TODO: default index name should be generated using https://github.com/sequelize/sequelize/issues/15312
        name: options.name || underscore(decoratorName),
        attribute: indexField,
      };

      return { index };
    },
  );
}

type IndexDecoratorOptions = NonUndefined<AttributeOptions['index']>;

export const Index = createOptionalAttributeOptionsDecorator<IndexDecoratorOptions>(
  'Index',
  {},
  (indexField: IndexDecoratorOptions): Partial<AttributeOptions> => {
    return {
      index: indexField,
    };
  },
);
