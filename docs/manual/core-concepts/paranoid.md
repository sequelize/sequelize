# Paranoid

Sequelize supports the concept of *paranoid* tables. A *paranoid* table is one that, when told to delete a record, it will not truly delete it. Instead, a special column called `deletedAt` will have its value set to the timestamp of that deletion request.

This means that paranoid tables perform a *soft-deletion* of records, instead of a *hard-deletion*.

## Defining a model as paranoid

To make a model paranoid, you must pass the `paranoid: true` option to the model definition. Paranoid requires timestamps to work (i.e. it won't work if you also pass `timestamps: false`).

You can also change the default column name (which is `deletedAt`) to something else.

```js
class Post extends Model {}
Post.init({ /* attributes here */ }, {
  sequelize,
  paranoid: true,

  // If you want to give a custom name to the deletedAt column
  deletedAt: 'destroyTime'
});
```

## Deleting

When you call the `destroy` method, a soft-deletion will happen:

```js
await Post.destroy({
  where: {
    id: 1
  }
});
// UPDATE "posts" SET "deletedAt"=[timestamp] WHERE "deletedAt" IS NULL AND "id" = 1
```

If you really want a hard-deletion and your model is paranoid, you can force it using the `force: true` option:

```js
await Post.destroy({
  where: {
    id: 1
  },
  force: true
});
// DELETE FROM "posts" WHERE "id" = 1
```

The above examples used the static `destroy` method as an example (`Post.destroy`), but everything works in the same way with the instance method:

```js
const post = await Post.create({ title: 'test' });
console.log(post instanceof Post); // true
await post.destroy(); // Would just set the `deletedAt` flag
await post.destroy({ force: true }); // Would really delete the record
```

## Restoring

To restore soft-deleted records, you can use the `restore` method, which comes both in the static version as well as in the instance version:

```js
// Example showing the instance `restore` method
// We create a post, soft-delete it and then restore it back
const post = await Post.create({ title: 'test' });
console.log(post instanceof Post); // true
await post.destroy();
console.log('soft-deleted!');
await post.restore();
console.log('restored!');

// Example showing the static `restore` method.
// Restoring every soft-deleted post with more than 100 likes
await Post.restore({
  where: {
    likes: {
      [Op.gt]: 100
    }
  }
});
```

## Behavior with other queries

Every query performed by Sequelize will automatically ignore soft-deleted records (except raw queries, of course).

This means that, for example, the `findAll` method will not see the soft-deleted records, fetching only the ones that were not deleted.

Even if you simply call `findByPk` providing the primary key of a soft-deleted record, the result will be `null` as if that record didn't exist.

If you really want to let the query see the soft-deleted records, you can pass the `paranoid: false` option to the query method. For example:

```js
await Post.findByPk(123); // This will return `null` if the record of id 123 is soft-deleted
await Post.findByPk(123, { paranoid: false }); // This will retrieve the record

await Post.findAll({
  where: { foo: 'bar' }
}); // This will not retrieve soft-deleted records

await Post.findAll({
  where: { foo: 'bar' },
  paranoid: false
}); // This will also retrieve soft-deleted records
```