<p align="center"><img src="https://raw.githubusercontent.com/sequelize/sequelize/ec80c6252ac500df9342816b7f49957f3974e882/logo.svg" width="100" alt="Sequelize logo" /></p>
<h1 align="center" style="margin-top: 0;"><a href="https://sequelize.org">Sequelize</a></h1>

This library contains model attribute validators built on top of [validator.js](https://www.npmjs.com/package/validator).
Read more about model validation in the [Sequelize documentation](https://sequelize.org/docs/v7/core-concepts/validations-and-constraints/).

## Installation

Using npm:

```sh
npm install @sequelize/validator.js
```

Or using yarn:

```sh
yarn add @sequelize/validator.js
```

## Usage

**⚠️ As indicated in the validator.js documentation, the library validates and sanitizes strings only.**

To add validation to your model, decorate your model attributes with the decorators exported by this library.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsEmail } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsEmail
  declare email: string;
}
```

## List of validators

This package exports the following validators:

### `Contains`

Checks if the string attribute contains the seed.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Contains } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Contains('foo')
  declare username: string;
}
```

### `NotContains`

Checks if the string attribute does not contain the seed.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { NotContains } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @NotContains('foo')
  declare username: string;
}
```

### `Equals`

Checks if the string attribute is exactly a value.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Equals } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Equals('foo')
  declare username: string;
}
```

### `Is`

Checks if the string attribute matches a regex.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Is } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Is(/foo/)
  declare username: string;
}
```

### `Not`

Checks if the string attribute does not match a regex.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Not } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Not(/foo/)
  declare username: string;
}
```

### `IsAfter`

Checks if the string attribute is a date that's after the specified date.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsAfter } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsAfter('2021-01-01')
  declare createdAt: string;
}
```

### `IsBefore`

Checks if the string attribute is a date that's before the specified date.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsBefore } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsBefore('2021-01-01')
  declare createdAt: string;
}
```

### `IsAlpha`

Checks if the string attribute contains only letters (a-zA-Z).

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsAlpha } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsAlpha
  declare username: string;
}
```

### `IsAlphanumeric`

Checks if the string attribute contains only letters and numbers.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsAlphanumeric } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsAlphanumeric
  declare username: string;
}
```

### `IsCreditCard`

Checks if the string attribute is a credit card number.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsCreditCard } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsCreditCard
  declare creditCard: string;
}
```

### `IsDate`

Checks if the string attribute is a date.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsDate
  declare createdAt: string;
}
```

### `IsDecimal`

Checks if the string attribute is a decimal number.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsDecimal } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsDecimal
  declare price: string;
}
```

### `IsEmail`

Checks if the string attribute is an email.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsEmail } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsEmail
  declare email: string;
}
```

### `IsFloat`

Checks if the string attribute is a float number.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsFloat } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsFloat
  declare price: string;
}
```

### `IsIP`

Checks if the string attribute is an IP address (4 or 6).

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsIP } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsIP(4) // optionally pass 4 or 6 to check for a specific IP version
  declare ip: string;
}
```

### `IsIPv4`

Checks if the string attribute is an IPv4 address.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsIPv4 } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsIPv4
  declare ipV4: string;
}
```

### `IsIPv6`

Checks if the string attribute is an IPv6 address.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsIPv6 } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsIPv6
  declare ipV6: string;
}
```

### `IsIn`

Checks if the string attribute is in a array of allowed values.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsIn } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsIn(['admin', 'user'])
  declare role: string;
}
```

### `NotIn`

Checks if the string attribute is not in a array of disallowed values.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { NotIn } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @NotIn(['admin', 'user'])
  declare role: string;
}
```

### `IsInt`

Checks if the string attribute is an integer.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsInt } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsInt
  declare age: string;
}
```

### `IsLowercase`

Checks if the string attribute is lowercase.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsLowercase } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsLowercase
  declare username: string;
}
```

### `IsNumeric`

Checks if the string attribute is numeric.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsNumeric } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsNumeric
  declare age: string;
}
```

### `IsUUID`

Checks if the string attribute is a UUID.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsUUID } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsUUID(4) // UUID version is optional
  declare uuid: string;
}
```

### `IsUppercase`

Checks if the string attribute is uppercase.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsUppercase } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsUppercase
  declare username: string;
}
```

### `IsUrl`

Checks if the string attribute is a URL.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { IsUrl } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @IsUrl
  declare website: string;
}
```

### `Length`

Checks if the string attribute has a length between min and max.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Length } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Length([3, 10])
  declare username: string;
}
```

### `Max`

Checks if the string attribute is not longer than the specified number of characters.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Max } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Max(10)
  declare username: string;
}
```

### `Min`

Checks if the string attribute is not shorter than the specified number of characters.

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { Min } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @Min(3)
  declare username: string;
}
```

### `NotEmpty`

Checks if the string attribute is not an empty string (after trimming).

```ts
import { Model, DataTypes } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { NotEmpty } from '@sequelize/validator.js';

class User extends Model {
  @Attribute(DataTypes.STRING)
  @NotNull
  @NotEmpty
  declare username: string;
}
```
