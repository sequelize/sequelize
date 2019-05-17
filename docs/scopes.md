# Scopes

Scoping allows you to define commonly used queries that you can easily use later. Scopes can include all the same attributes as regular finders, `where`, `include`, `limit` etc.

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
        { model: User, where: { active: true }}
      ]
    },
    random () {
      return {
        where: {
          someNumber: Math.random()
        }
      }
    },
    accessLevel (value) {
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

You can also add scopes after a model has been defined by calling `addScope`. This is especially useful for scopes with includes, where the model in the include might not be defined at the time the other model is being defined.

The default scope is always applied. This means, that with the model definition above, `Project.findAll()` will create the following query:

```sql
SELECT * FROM projects WHERE active = true
```

The default scope can be removed by calling `.unscoped()`, `.scope(null)`, or by invoking another scope:

```js
Project.scope('deleted').findAll(); // Removes the default scope
```

```sql
SELECT * FROM projects WHERE deleted = true
```

It is also possible to include scoped models in a scope definition. This allows you to avoid duplicating `include`, `attributes` or `where` definitions.
Using the above example, and invoking the `active` scope on the included User model (rather than specifying the condition directly in that include object):

```js
activeUsers: {
  include: [
    { model: User.scope('active')}
  ]
}
```

## Usage

Scopes are applied by calling `.scope` on the model definition, passing the name of one or more scopes. `.scope` returns a fully functional model instance with all the regular methods: `.findAll`, `.update`, `.count`, `.destroy` etc. You can save this model instance and reuse it later:

```js
const DeletedProjects = Project.scope('deleted');

DeletedProjects.findAll();
// some time passes

// let's look for deleted projects again!
DeletedProjects.findAll();
```

Scopes apply to `.find`, `.findAll`, `.count`, `.update`, `.increment` and `.destroy`.

Scopes which are functions can be invoked in two ways. If the scope does not take any arguments it can be invoked as normally. If the scope takes arguments, pass an object:

```js
Project.scope('random', { method: ['accessLevel', 19]}).findAll();
```

```sql
SELECT * FROM projects WHERE someNumber = 42 AND accessLevel >= 19
```

## Merging

Several scopes can be applied simultaneously by passing an array of scopes to `.scope`, or by passing the scopes as consecutive arguments.

```js
// These two are equivalent
Project.scope('deleted', 'activeUsers').findAll();
Project.scope(['deleted', 'activeUsers']).findAll();
```

```sql
SELECT * FROM projects
INNER JOIN users ON projects.userId = users.id
WHERE projects.deleted = true
AND users.active = true
```

If you want to apply another scope alongside the default scope, pass the key `defaultScope` to `.scope`:

```js
Project.scope('defaultScope', 'deleted').findAll();
```

```sql
SELECT * FROM projects WHERE active = true AND deleted = true
```

When invoking several scopes, keys from subsequent scopes will overwrite previous ones (similarly to [Object.assign](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)), except for `where` and `include`, which will be merged. Consider two scopes:

```js
{
  scope1: {
    where: {
      firstName: 'bob',
      age: {
        [Op.gt]: 20
      }
    },
    limit: 2
  },
  scope2: {
    where: {
      age: {
        [Op.gt]: 30
      }
    },
    limit: 10
  }
}
```

Calling `.scope('scope1', 'scope2')` will yield the following query

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

```sql
WHERE deleted = true AND firstName = 'john'
```

Here the `deleted` scope is merged with the finder. If we were to pass `where: { firstName: 'john', deleted: false }` to the finder, the `deleted` scope would be overwritten.

### Merging includes

Includes are merged recursively based on the models being included. This is a very powerful merge, added on v5, and is better understood with an example.

Consider four models: Foo, Bar, Baz and Qux, with has-many associations as follows:

```js
class Foo extends Model {}
class Bar extends Model {}
class Baz extends Model {}
class Qux extends Model {}
Foo.init({ name: Sequelize.STRING }, { sequelize });
Bar.init({ name: Sequelize.STRING }, { sequelize });
Baz.init({ name: Sequelize.STRING }, { sequelize });
Qux.init({ name: Sequelize.STRING }, { sequelize });
Foo.hasMany(Bar, { foreignKey: 'fooId' });
Bar.hasMany(Baz, { foreignKey: 'barId' });
Baz.hasMany(Qux, { foreignKey: 'bazId' });
```

Now, consider the following four scopes defined on Foo:

```js
{
  includeEverything: {
    include: {
      model: this.Bar,
      include: [{
        model: this.Baz,
        include: this.Qux
      }]
    }
  },
  limitedBars: {
    include: [{
      model: this.Bar,
      limit: 2
    }]
  },
  limitedBazs: {
    include: [{
      model: this.Bar,
      include: [{
        model: this.Baz,
        limit: 2
      }]
    }]
  },
  excludeBazName: {
    include: [{
      model: this.Bar,
      include: [{
        model: this.Baz,
        attributes: {
          exclude: ['name']
        }
      }]
    }]
  }
}
```

These four scopes can be deeply merged easily, for example by calling `Foo.scope('includeEverything', 'limitedBars', 'limitedBazs', 'excludeBazName').findAll()`, which would be entirely equivalent to calling the following:

```js
Foo.findAll({
  include: {
    model: this.Bar,
    limit: 2,
    include: [{
      model: this.Baz,
      limit: 2,
      attributes: {
        exclude: ['name']
      },
      include: this.Qux
    }]
  }
});
```

Observe how the four scopes were merged into one. The includes of scopes are merged based on the model being included. If one scope includes model A and another includes model B, the merged result will include both models A and B. On the other hand, if both scopes include the same model A, but with different options (such as nested includes or other attributes), those will be merged recursively, as shown above.

The merge illustrated above works in the exact same way regardless of the order applied to the scopes. The order would only make a difference if a certain option was set by two different scopes - which is not the case of the above example, since each scope does a different thing.

This merge strategy also works in the exact same way with options passed to `.findAll`, `.findOne` and the like.

## Associations

Sequelize has two different but related scope concepts in relation to associations. The difference is subtle but important:

* **Association scopes** Allow you to specify default attributes when getting and setting associations - useful when implementing polymorphic associations. This scope is only invoked on the association between the two models, when using the `get`, `set`, `add` and `create` associated model functions
* **Scopes on associated models** Allows you to apply default and other scopes when fetching associations, and allows you to pass a scoped model when creating associations. These scopes both apply to regular finds on the model and to find through the association.

As an example, consider the models Post and Comment. Comment is associated to several other models (Image, Video etc.) and the association between Comment and other models is polymorphic, which means that Comment stores a `commentable` column, in addition to the foreign key `commentable_id`.

The polymorphic association can be implemented with an _association scope_ :

```js
this.Post.hasMany(this.Comment, {
  foreignKey: 'commentable_id',
  scope: {
    commentable: 'post'
  }
});
```

When calling `post.getComments()`, this will automatically add `WHERE commentable = 'post'`. Similarly, when adding new comments to a post, `commentable` will automagically be set to `'post'`. The association scope is meant to live in the background without the programmer having to worry about it - it cannot be disabled. For a more complete polymorphic example, see [Association scopes](/manual/associations.html#scopes)

Consider then, that Post has a default scope which only shows active posts: `where: { active: true }`. This scope lives on the associated model (Post), and not on the association like the `commentable` scope did. Just like the default scope is applied when calling `Post.findAll()`, it is also applied when calling `User.getPosts()` - this will only return the active posts for that user.

To disable the default scope, pass `scope: null` to the getter: `User.getPosts({ scope: null })`. Similarly, if you want to apply other scopes, pass an array like you would to `.scope`:

```js
User.getPosts({ scope: ['scope1', 'scope2']});
```

If you want to create a shortcut method to a scope on an associated model, you can pass the scoped model to the association. Consider a shortcut to get all deleted posts for a user:

```js
class Post extends Model {}
Post.init(attributes, {
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
    }
  },
  sequelize,
});

User.hasMany(Post); // regular getPosts association
User.hasMany(Post.scope('deleted'), { as: 'deletedPosts' });

```

```js
User.getPosts(); // WHERE active = true
User.getDeletedPosts(); // WHERE deleted = true
```
