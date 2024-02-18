import type { ForeignKey, InferAttributes } from '@sequelize/core';
import { Model } from '@sequelize/core';

class Car extends Model<InferAttributes<Car>> {
  declare person: ForeignKey<number>;
}

class Person extends Model<InferAttributes<Person>> {
  declare id: number;
}

class Country extends Model<InferAttributes<Country>> {
  declare cId: number;
}

class PersonCountry extends Model<InferAttributes<PersonCountry>> {
  declare personId: ForeignKey<number>;
  declare countryId: ForeignKey<number>;
}

// BelongsTo

Car.belongsTo(Person);
Car.belongsTo(Person, { foreignKey: 'person' });
Car.belongsTo(Person, { foreignKey: { name: 'person' } });

// @ts-expect-error -- this foreign key does not exist on Car
Car.belongsTo(Person, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Car.belongsTo(Person, { foreignKey: { name: 'doesnotexist' } });

Car.belongsTo(Person, { targetKey: 'id' });
// @ts-expect-error -- this should error, if this doesn't error, there is a bug!
Car.belongsTo(Person, { targetKey: 'doesnotexist' });

// HasOne

Person.hasOne(Car);
Person.hasOne(Car, { foreignKey: 'person' });
Person.hasOne(Car, { foreignKey: { name: 'person' } });

// @ts-expect-error -- this foreign key does not exist on Car
Person.hasOne(Car, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Person.hasOne(Car, { foreignKey: { name: 'doesnotexist' } });

Person.hasOne(Car, { sourceKey: 'id' });
// @ts-expect-error -- this should error, if this doesn't error, there is a bug!
Person.hasOne(Car, { sourceKey: 'doesnotexist' });

// HasMany

Person.hasMany(Car);
Person.hasMany(Car, { foreignKey: 'person' });
Person.hasMany(Car, { foreignKey: { name: 'person' } });

// @ts-expect-error -- this foreign key does not exist on Car
Person.hasMany(Car, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Person.hasMany(Car, { foreignKey: { name: 'doesnotexist' } });

Person.hasMany(Car, { sourceKey: 'id' });
// @ts-expect-error -- this should error, if this doesn't error, there is a bug!
Person.hasMany(Car, { sourceKey: 'doesnotexist' });

// BelongsToMany

Person.belongsToMany(Country, { through: 'PersonCountry' });

// through model uses weak typings because it's set as a string. ForeignKey and OtherKey are not strictly checked.
Person.belongsToMany(Country, {
  through: 'PersonCountry',
  foreignKey: 'doesNotMatter',
  otherKey: 'doesNotMatterEither',
});
Person.belongsToMany(Country, {
  through: { model: 'PersonCountry' },
  foreignKey: 'doesNotMatter',
  otherKey: 'doesNotMatterEither',
});

Person.belongsToMany(Country, {
  through: PersonCountry,
  foreignKey: 'personId',
  otherKey: 'countryId',
});
Person.belongsToMany(Country, {
  through: { model: PersonCountry },
  foreignKey: 'personId',
  otherKey: 'countryId',
});

Person.belongsToMany(Country, {
  through: PersonCountry,
  // @ts-expect-error -- this must fail, 'through' is strongly defined and ForeignKey does not exist
  foreignKey: 'doesNotExist',
  otherKey: 'countryId',
});

Person.belongsToMany(Country, {
  through: PersonCountry,
  foreignKey: 'personId',
  // @ts-expect-error -- this must fail, 'through' is strongly defined and OtherKey does not exist
  otherKey: 'doesNotExist',
});

Person.belongsToMany(Country, {
  through: { model: PersonCountry },
  foreignKey: 'personId',
  // @ts-expect-error -- this must fail, 'through' is strongly defined and OtherKey does not exist
  otherKey: 'doesNotExist',
});

Person.belongsToMany(Country, {
  through: 'PersonCountry',
  sourceKey: 'id',
  targetKey: 'cId',
});

Person.belongsToMany(Country, {
  through: 'PersonCountry',
  // @ts-expect-error -- this key does not exist on Person
  sourceKey: 'doesNotExist',
  targetKey: 'cId',
});

Person.belongsToMany(Country, {
  through: 'PersonCountry',
  sourceKey: 'id',
  // @ts-expect-error -- this key does not exist on Country
  targetKey: 'doesNotExist',
});
