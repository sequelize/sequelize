import { ForeignKey, InferAttributes, Model } from '@sequelize/core';

class Car extends Model<InferAttributes<Car>> {
  declare person: ForeignKey<number>;
}

class Person extends Model<InferAttributes<Person>> {

}

class Country extends Model<InferAttributes<Country>> {

}

class PersonCountry extends Model<InferAttributes<PersonCountry>> {
  declare personId: ForeignKey<number>;
  declare countryId: ForeignKey<number>;
}

// BelongsTo

Car.belongsTo(Person);
Car.belongsTo(Person, { foreignKey: 'person' });
Car.belongsTo(Person, { foreignKey: { name: 'person'} });

// @ts-expect-error -- this foreign key does not exist on Car
Car.belongsTo(Person, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Car.belongsTo(Person, { foreignKey: { name: 'doesnotexist'} });

// HasOne

Person.hasOne(Car);
Person.hasOne(Car, { foreignKey: 'person' });
Person.hasOne(Car, { foreignKey: { name: 'person'} });

// @ts-expect-error -- this foreign key does not exist on Car
Person.hasOne(Car, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Person.hasOne(Car, { foreignKey: { name: 'doesnotexist'} });

// HasMany

Person.hasMany(Car);
Person.hasMany(Car, { foreignKey: 'person' });
Person.hasMany(Car, { foreignKey: { name: 'person'} });

// @ts-expect-error -- this foreign key does not exist on Car
Person.hasMany(Car, { foreignKey: 'doesnotexist' });
// @ts-expect-error -- this foreign key does not exist on Car
Person.hasMany(Car, { foreignKey: { name: 'doesnotexist'} });

// BelongsToMany

Person.belongsToMany(Country, { through: 'PersonCountry' });

// through model uses weak typings because it's set as a string. ForeignKey and OtherKey are not strictly checked.
Person.belongsToMany(Country, { through: 'PersonCountry', foreignKey: 'doesNotMatter', otherKey: 'doesNotMatterEither' });
Person.belongsToMany(Country, { through: { model: 'PersonCountry' }, foreignKey: 'doesNotMatter', otherKey: 'doesNotMatterEither' });

Person.belongsToMany(Country, { through: PersonCountry, foreignKey: 'personId', otherKey: 'countryId' });
Person.belongsToMany(Country, { through: { model: PersonCountry }, foreignKey: 'personId', otherKey: 'countryId' });

// @ts-expect-error -- this must fail, 'through' is strongly defined and ForeignKey does not exist
Person.belongsToMany(Country, { through: PersonCountry, foreignKey: 'doesNotExist', otherKey: 'countryId' });

// @ts-expect-error -- this must fail, 'through' is strongly defined and OtherKey does not exist
Person.belongsToMany(Country, { through: PersonCountry, foreignKey: 'personId', otherKey: 'doesNotExist' });

// @ts-expect-error -- this must fail, 'through' is strongly defined and OtherKey does not exist
Person.belongsToMany(Country, { through: { model: PersonCountry }, foreignKey: 'personId', otherKey: 'doesNotExist' });
