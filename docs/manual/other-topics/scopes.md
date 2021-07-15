# Scopes

Scopes are used to help you reuse code. You can define commonly used queries, specifying options such as `where`, `include`, `limit`, etc.

This guide concerns model scopes. You might also be interested in the [guide for association scopes](association-scopes.html), which are similar but not the same thing.

## Definition

Scopes are defined in the model definition and can be finder objects, or functions returning finder objects - except for the default scope, which can only be an object:

```js
class Project extends Model {}
Project.init({
  // Attributes
}, {
  defaultScope: {
    where: {
      active: true
    }
  },
  scopes: {
    deleted: {
      where: {
        deleted: true
      }
    },
    activeUsers: {
      include: [
        { model: User, where: { active: true } }
      ]
    },
    random() {
      return {
        where: {
          someNumber: Math.random()
        }
      }
    },
    accessLevel(value) {
      return {
        where: {
          accessLevel: {
            [Op.gte]: value
          }
        }
      }
    }
    sequelize,
    modelName: 'project'
  }
});
```

You can also add scopes after a model has been defined by calling [`YourModel.addScope`](../class/lib/model.js~Model.html#static-method-addScope). This is especially useful for scopes with includes, where the model in the include might not be defined at the time the other model is being defined.

The default scope is always applied. This means, that with the model definition above, `Project.findAll()` will create the following query:

```sql
SELECT * FROM projects WHERE active = true
```

The default scope can be removed by calling `.unscoped()`, `.scope(null)`, or by invoking another scope:

```js
await Project.scope('deleted').findAll(); // Removes the default scope
```

```sql
SELECT * FROM projects WHERE deleted = true
```

It is also possible to include scoped models in a scope definition. This allows you to avoid duplicating `include`, `attributes` or `where` definitions. Using the above example, and invoking the `active` scope on the included User model (rather than specifying the condition directly in that include object):

```js
// The `activeUsers` scope defined in the example above could also have been defined this way:
Project.addScope('activeUsers', {
  include: [
    { model: User.scope('active') }
  ]
});
```

## Usage

Scopes are applied by calling `.scope` on the model definition, passing the name of one or more scopes. `.scope` returns a fully functional model instance with all the regular methods: `.findAll`, `.update`, `.count`, `.destroy` etc. You can save this model instance and reuse it later:

```js
const DeletedProjects = Project.scope('deleted');
await DeletedProjects.findAll();

// The above is equivalent to:
await Project.findAll({
  where: {
    deleted: true
  }
});
```

Scopes apply to `.find`, `.findAll`, `.count`, `.update`, `.increment` and `.destroy`.

Scopes which are functions can be invoked in two ways. If the scope does not take any arguments it can be invoked as normally. If the scope takes arguments, pass an object:

```js
await Project.scope('random', { method: ['accessLevel', 19] }).findAll();
```

Generated SQL:

```sql
SELECT * FROM projects WHERE someNumber = 42 AND accessLevel >= 19
```

## Merging

Several scopes can be applied simultaneously by passing an array of scopes to `.scope`, or by passing the scopes as consecutive arguments.

```js
// These two are equivalent
await Project.scope('deleted', 'activeUsers').findAll();
await Project.scope(['deleted', 'activeUsers']).findAll();
```

Generated SQL:

```sql
SELECT * FROM projects
INNER JOIN users ON projects.userId = users.id
WHERE projects.deleted = true
AND users.active = true
```

If you want to apply another scope alongside the default scope, pass the key `defaultScope` to `.scope`:

```js
await Project.scope('defaultScope', 'deleted').findAll();
```

Generated SQL:

```sql
SELECT * FROM projects WHERE active = true AND deleted = true
```

When invoking several scopes, keys from subsequent scopes will overwrite previous ones (similarly to [Object.assign](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)), except for `where` and `include`, which will be merged. Consider two scopes:

```js
YourMode.addScope('scope1', {
  where: {
    firstName: 'bob',
    age: {
      [Op.gt]: 20
    }
  },
  limit: 2
});
YourMode.addScope('scope2', {
  where: {
    age: {
      [Op.gt]: 30
    }
  },
  limit: 10
});
```

Using `.scope('scope1', 'scope2')` will yield the following WHERE clause:

```sql
WHERE firstName = 'bob' AND age > 30 LIMIT 10
```

Note how `limit` and `age` are overwritten by `scope2`, while `firstName` is preserved. The `limit`, `offset`, `order`, `paranoid`, `lock` and `raw` fields are overwritten, while `where` is shallowly merged (meaning that identical keys will be overwritten). The merge strategy for `include` will be discussed later on.

Note that `attributes` keys of multiple applied scopes are merged in such a way that `attributes.exclude` are always preserved. This allows merging several scopes and never leaking sensitive fields in final scope.

The same merge logic applies when passing a find object directly to `findAll` (and similar finders) on a scoped model:

```js
Project.scope('deleted').findAll({
  where: {
    firstName: 'john'
  }
})
```

Generated where clause:

```sql
WHERE deleted = true AND firstName = 'john'
```

Here the `deleted` scope is merged with the finder. If we were to pass `where: { firstName: 'john', deleted: false }` to the finder, the `deleted` scope would be overwritten.

### Merging includes

Includes are merged recursively based on the models being included. This is a very powerful merge, added on v5, and is better understood with an example.

Consider the models `Foo`, `Bar`, `Baz` and `Qux`, with One-to-Many associations as follows:

```js
const Foo = sequelize.define('Foo', { name: Sequelize.STRING });
const Bar = sequelize.define('Bar', { name: Sequelize.STRING });
const Baz = sequelize.define('Baz', { name: Sequelize.STRING });
const Qux = sequelize.define('Qux', { name: Sequelize.STRING });
Foo.hasMany(Bar, { foreignKey: 'fooId' });
Bar.hasMany(Baz, { foreignKey: 'barId' });
Baz.hasMany(Qux, { foreignKey: 'bazId' });
```

Now, consider the following four scopes defined on Foo:

```js
Foo.addScope('includeEverything', {
  include: {
    model: Bar,
    include: [{
      model: Baz,
      include: Qux
    }]
  }
});

Foo.addScope('limitedBars', {
  include: [{
    model: Bar,
    limit: 2
  }]
});

Foo.addScope('limitedBazs', {
  include: [{
    model: Bar,
    include: [{
      model: Baz,
      limit: 2
    }]
  }]
});

Foo.addScope('excludeBazName', {
  include: [{
    model: Bar,
    include: [{
      model: Baz,
      attributes: {
        exclude: ['name']
      }
    }]
  }]
});
```

These four scopes can be deeply merged easily, for example by calling `Foo.scope('includeEverything', 'limitedBars', 'limitedBazs', 'excludeBazName').findAll()`, which would be entirely equivalent to calling the following:

```js
await Foo.findAll({
  include: {
    model: Bar,
    limit: 2,
    include: [{
      model: Baz,
      limit: 2,
      attributes: {
        exclude: ['name']
      },
      include: Qux
    }]
  }
});

// The above is equivalent to:
await Foo.scope([
  'includeEverything',
  'limitedBars',
  'limitedBazs',
  'excludeBazName'
]).findAll();
```

Observe how the four scopes were merged into one. The includes of scopes are merged based on the model being included. If one scope includes model A and another includes model B, the merged result will include both models A and B. On the other hand, if both scopes include the same model A, but with different options (such as nested includes or other attributes), those will be merged recursively, as shown above.

The merge illustrated above works in the exact same way regardless of the order applied to the scopes. The order would only make a difference if a certain option was set by two different scopes - which is not the case of the above example, since each scope does a different thing.

This merge strategy also works in the exact same way with options passed to `.findAll`, `.findOne` and the like.