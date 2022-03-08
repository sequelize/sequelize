## Association Aliases & Custom Foreign Keys

In all the above examples, Sequelize automatically defined the foreign key names. For example, in the Ship and Captain example, Sequelize automatically defined a `captainId` field on the Ship model. However, it is easy to specify a custom foreign key.

Let's consider the models Ship and Captain in a simplified form, just to focus on the current topic, as shown below (less fields):

```js
const Ship = sequelize.define('ship', { name: DataTypes.TEXT }, { timestamps: false });
const Captain = sequelize.define('captain', { name: DataTypes.TEXT }, { timestamps: false });
```

There are three ways to specify a different name for the foreign key:

* By providing the foreign key name directly
* By defining an Alias
* By doing both things

### Recap: the default setup

By using simply `Ship.belongsTo(Captain)`, sequelize will generate the foreign key name automatically:

```js
Ship.belongsTo(Captain); // This creates the `captainId` foreign key in Ship.

// Eager Loading is done by passing the model to `include`:
console.log((await Ship.findAll({ include: Captain })).toJSON());
// Or by providing the associated model name:
console.log((await Ship.findAll({ include: 'captain' })).toJSON());

// Also, instances obtain a `getCaptain()` method for Lazy Loading:
const ship = Ship.findOne();
console.log((await ship.getCaptain()).toJSON());
```

### Providing the foreign key name directly

The foreign key name can be provided directly with an option in the association definition, as follows:

```js
Ship.belongsTo(Captain, { foreignKey: 'bossId' }); // This creates the `bossId` foreign key in Ship.

// Eager Loading is done by passing the model to `include`:
console.log((await Ship.findAll({ include: Captain })).toJSON());
// Or by providing the associated model name:
console.log((await Ship.findAll({ include: 'Captain' })).toJSON());

// Also, instances obtain a `getCaptain()` method for Lazy Loading:
const ship = Ship.findOne();
console.log((await ship.getCaptain()).toJSON());
```

### Defining an Alias

Defining an Alias is more powerful than simply specifying a custom name for the foreign key. This is better understood with an example:

<!-- NOTE: any change in this part might also require a change on advanced-many-to-many.md -->

```js
Ship.belongsTo(Captain, { as: 'leader' }); // This creates the `leaderId` foreign key in Ship.

// Eager Loading no longer works by passing the model to `include`:
console.log((await Ship.findAll({ include: Captain })).toJSON()); // Throws an error
// Instead, you have to pass the alias:
console.log((await Ship.findAll({ include: 'leader' })).toJSON());
// Or you can pass an object specifying the model and alias:
console.log((await Ship.findAll({
  include: {
    model: Captain,
    as: 'leader'
  }
})).toJSON());

// Also, instances obtain a `getLeader()` method for Lazy Loading:
const ship = Ship.findOne();
console.log((await ship.getLeader()).toJSON());
```

Aliases are especially useful when you need to define two different associations between the same models. For example, if we have the models `Mail` and `Person`, we may want to associate them twice, to represent the `sender` and `receiver` of the Mail. In this case we must use an alias for each association, since otherwise a call like `mail.getPerson()` would be ambiguous. With the `sender` and `receiver` aliases, we would have the two methods available and working: `mail.getSender()` and `mail.getReceiver()`, both of them returning a `Promise<Person>`.

When defining an alias for a `hasOne` or `belongsTo` association, you should use the singular form of a word (such as `leader`, in the example above). On the other hand, when defining an alias for `hasMany` and `belongsToMany`, you should use the plural form. Defining aliases for Many-to-Many relationships (with `belongsToMany`) is covered in the [Advanced Many-to-Many Associations guide](advanced-many-to-many.html).

### Doing both things

We can define and alias and also directly define the foreign key:

```js
Ship.belongsTo(Captain, { as: 'leader', foreignKey: 'bossId' }); // This creates the `bossId` foreign key in Ship.

// Since an alias was defined, eager Loading doesn't work by simply passing the model to `include`:
console.log((await Ship.findAll({ include: Captain })).toJSON()); // Throws an error
// Instead, you have to pass the alias:
console.log((await Ship.findAll({ include: 'leader' })).toJSON());
// Or you can pass an object specifying the model and alias:
console.log((await Ship.findAll({
  include: {
    model: Captain,
    as: 'leader'
  }
})).toJSON());

// Also, instances obtain a `getLeader()` method for Lazy Loading:
const ship = Ship.findOne();
console.log((await ship.getLeader()).toJSON());
```

## Special methods/mixins added to instances

### Note: Method names

As shown in the examples above, the names Sequelize gives to these special methods are formed by a prefix (e.g. `get`, `add`, `set`) concatenated with the model name (with the first letter in uppercase). When necessary, the plural is used, such as in `fooInstance.setBars()`.
Again, irregular plurals are also handled automatically by Sequelize. For example, `Person` becomes `People` and `Hypothesis` becomes `Hypotheses`.

If an alias was defined, it will be used instead of the model name to form the method names. For example:

```js
Task.hasOne(User, { as: 'Author' });
```

* `taskInstance.getAuthor()`
* `taskInstance.setAuthor()`
* `taskInstance.createAuthor()`

## Why associations are defined in pairs?

As mentioned earlier and shown in most examples above, usually associations in Sequelize are defined in pairs:

* To create a **One-To-One** relationship, the `hasOne` and `belongsTo` associations are used together;
* To create a **One-To-Many** relationship, the `hasMany` and `belongsTo` associations are used together;
* To create a **Many-To-Many** relationship, two `belongsToMany` calls are used together.

When a Sequelize association is defined between two models, only the *source* model *knows about it*. So, for example, when using `Foo.hasOne(Bar)` (so `Foo` is the source model and `Bar` is the target model), only `Foo` knows about the existence of this association. This is why in this case, as shown above, `Foo` instances gain the methods `getBar()`, `setBar()` and `createBar()`, while on the other hand `Bar` instances get nothing.

Similarly, for `Foo.hasOne(Bar)`, since `Foo` knows about the relationship, we can perform eager loading as in `Foo.findOne({ include: Bar })`, but we can't do `Bar.findOne({ include: Foo })`.

Therefore, to bring full power to Sequelize usage, we usually setup the relationship in pairs, so that both models get to *know about it*.

Practical demonstration:

* If we do not define the pair of associations, calling for example just `Foo.hasOne(Bar)`:

  ```js
  // This works...
  await Foo.findOne({ include: Bar });

  // But this throws an error:
  await Bar.findOne({ include: Foo });
  // SequelizeEagerLoadingError: foo is not associated to bar!
  ```

* If we define the pair as recommended, i.e., both `Foo.hasOne(Bar)` and `Bar.belongsTo(Foo)`:

  ```js
  // This works!
  await Foo.findOne({ include: Bar });

  // This also works!
  await Bar.findOne({ include: Foo });
  ```

## Multiple associations involving the same models

In Sequelize, it is possible to define multiple associations between the same models. You just have to define different aliases for them:

```js
Team.hasOne(Game, { as: 'HomeTeam', foreignKey: 'homeTeamId' });
Team.hasOne(Game, { as: 'AwayTeam', foreignKey: 'awayTeamId' });
Game.belongsTo(Team);
```
