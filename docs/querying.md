# Querying

## Attributes

To select only some attributes, you can use the `attributes` option. Most often, you pass an array:

```js
Model.findAll({
  attributes: ['foo', 'bar']
});
```
```sql
SELECT foo, bar ...
```

Attributes can be renamed using a nested array:

```js
Model.findAll({
  attributes: ['foo', ['bar', 'baz']]
});
```
```sql
SELECT foo, bar AS baz ...
```

You can use `sequelize.fn` to do aggregations:

```js
Model.findAll({
  attributes: [[sequelize.fn('COUNT', sequelize.col('hats')), 'no_hats']]
});
```
```sql
SELECT COUNT(hats) AS no_hats ...
```

When using aggregation function, you must give it an alias to be able to access it from the model. In the example above you can get the number of hats with `instance.get('no_hats')`.

Sometimes it may be tiresome to list all the attributes of the model if you only want to add an aggregation:

```js
// This is a tiresome way of getting the number of hats...
Model.findAll({
  attributes: ['id', 'foo', 'bar', 'baz', 'quz', [sequelize.fn('COUNT', sequelize.col('hats')), 'no_hats']]
});

// This is shorter, and less error prone because it still works if you add / remove attributes
Model.findAll({
  attributes: { include: [[sequelize.fn('COUNT', sequelize.col('hats')), 'no_hats']] }
});
```
```sql
SELECT id, foo, bar, baz, quz, COUNT(hats) AS no_hats ...
```

Similarly, its also possible to remove a selected few attributes:

```js
Model.findAll({
  attributes: { exclude: ['baz'] }
});
```
```sql
SELECT id, foo, bar, quz ...
```


## Where

Whether you are querying with findAll/find or doing bulk updates/destroys you can pass a `where` object to filter the query.

`where` generally takes an object from attribute:value pairs, where value can be primitives for equality matches or keyed objects for other operators.

It's also possible to generate complex AND/OR conditions by nesting sets of `$or` and `$and`.

### Basics
```js
Post.findAll({
  where: {
    authorId: 2
  }
});
// SELECT * FROM post WHERE authorId = 2

Post.findAll({
  where: {
    authorId: 12,
    status: 'active'
  }
});
// SELECT * FROM post WHERE authorId = 12 AND status = 'active';

Post.destroy({
  where: {
    status: 'inactive'
  }
});
// DELETE FROM post WHERE status = 'inactive';

Post.update({
  updatedAt: null,
}, {
  where: {
    deletedAt: {
      $ne: null
    }
  }
});
// UPDATE post SET updatedAt = null WHERE deletedAt NOT NULL;

Post.findAll({
  where: sequelize.where(sequelize.fn('char_length', sequelize.col('status')), 6)
});
// SELECT * FROM post WHERE char_length(status) = 6;
```

### Operators

```js
$and: {a: 5}           // AND (a = 5)
$or: [{a: 5}, {a: 6}]  // (a = 5 OR a = 6)
$gt: 6,                // > 6
$gte: 6,               // >= 6
$lt: 10,               // < 10
$lte: 10,              // <= 10
$ne: 20,               // != 20
$eq: 3,                // = 3
$not: true,            // IS NOT TRUE
$between: [6, 10],     // BETWEEN 6 AND 10
$notBetween: [11, 15], // NOT BETWEEN 11 AND 15
$in: [1, 2],           // IN [1, 2]
$notIn: [1, 2],        // NOT IN [1, 2]
$like: '%hat',         // LIKE '%hat'
$notLike: '%hat'       // NOT LIKE '%hat'
$iLike: '%hat'         // ILIKE '%hat' (case insensitive) (PG only)
$notILike: '%hat'      // NOT ILIKE '%hat'  (PG only)
$like: { $any: ['cat', 'hat']}
                       // LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
$overlap: [1, 2]       // && [1, 2] (PG array overlap operator)
$contains: [1, 2]      // @> [1, 2] (PG array contains operator)
$contained: [1, 2]     // <@ [1, 2] (PG array contained by operator)
$any: [2,3]            // ANY ARRAY[2, 3]::INTEGER (PG only)

$col: 'user.organization_id' // = "user"."organization_id", with dialect specific column identifiers, PG in this example
```

### Range Operators

Range types can be queried with all supported operators.

Keep in mind, the provided range value can
[define the bound inclusion/exclusion](/manual/tutorial/models-definition.html#range-types)
as well.

```js
// All the above equality and inequality operators plus the following:

$contains: 2           // @> '2'::integer (PG range contains element operator)
$contains: [1, 2]      // @> [1, 2) (PG range contains range operator)
$contained: [1, 2]     // <@ [1, 2) (PG range is contained by operator)
$overlap: [1, 2]       // && [1, 2) (PG range overlap (have points in common) operator)
$adjacent: [1, 2]      // -|- [1, 2) (PG range is adjacent to operator)
$strictLeft: [1, 2]    // << [1, 2) (PG range strictly left of operator)
$strictRight: [1, 2]   // >> [1, 2) (PG range strictly right of operator)
$noExtendRight: [1, 2] // &< [1, 2) (PG range does not extend to the right of operator)
$noExtendLeft: [1, 2]  // &> [1, 2) (PG range does not extend to the left of operator)
```

### Combinations
```js
{
  rank: {
    $or: {
      $lt: 1000,
      $eq: null
    }
  }
}
// rank < 1000 OR rank IS NULL

{
  createdAt: {
    $lt: new Date(),
    $gt: new Date(new Date() - 24 * 60 * 60 * 1000)
  }
}
// createdAt < [timestamp] AND createdAt > [timestamp]

{
  $or: [
    {
      title: {
        $like: 'Boat%'
      }
    },
    {
      description: {
        $like: '%boat%'
      }
    }
  ]
}
// title LIKE 'Boat%' OR description LIKE '%boat%'
```

### JSONB

JSONB can be queried in three different ways.

#### Nested object
```js
{
  meta: {
    video: {
      url: {
        $ne: null
      }
    }
  }
}
```

#### Nested key
```js
{
  "meta.audio.length": {
    $gt: 20
  }
}
```

#### Containment
```js
{
  "meta": {
    $contains: {
      site: {
        url: 'http://google.com'
      }
    }
  }
}
```

### Relations / Associations
```js
// Find all projects with a least one task where task.state === project.state
Project.findAll({
    include: [{
        model: Task,
        where: { state: Sequelize.col('project.state') }
    }]
})
```

## Pagination / Limiting

```js
// Fetch 10 instances/rows
Project.findAll({ limit: 10 })

// Skip 8 instances/rows
Project.findAll({ offset: 8 })

// Skip 5 instances and fetch the 5 after that
Project.findAll({ offset: 5, limit: 5 })
```

## Ordering

`order` takes an array of items to order the query by or a sequelize method. Generally you will want to use a tuple/array of either attribute, direction or just direction to ensure proper escaping.

```js
Subtask.findAll({
  order: [
    // Will escape username and validate DESC against a list of valid direction parameters
    ['title', 'DESC'],

    // Will order by max(age)
    sequelize.fn('max', sequelize.col('age')),

    // Will order by max(age) DESC
    [sequelize.fn('max', sequelize.col('age')), 'DESC'],

    // Will order by  otherfunction(`col1`, 12, 'lalala') DESC
    [sequelize.fn('otherfunction', sequelize.col('col1'), 12, 'lalala'), 'DESC'],

    // Will order an associated model's created_at using the model name as the association's name.
    [Task, 'createdAt', 'DESC'],

    // Will order through an associated model's created_at using the model names as the associations' names.
    [Task, Project, 'createdAt', 'DESC'],

    // Will order by an associated model's created_at using the name of the association.
    ['Task', 'createdAt', 'DESC'],

    // Will order by a nested associated model's created_at using the names of the associations.
    ['Task', 'Project', 'createdAt', 'DESC'],

    // Will order by an associated model's created_at using an association object. (preferred method)
    [Subtask.associations.Task, 'createdAt', 'DESC'],

    // Will order by a nested associated model's created_at using association objects. (preferred method)
    [Subtask.associations.Task, Task.associations.Project, 'createdAt', 'DESC'],

    // Will order by an associated model's created_at using a simple association object.
    [{model: Task, as: 'Task'}, 'createdAt', 'DESC'],

    // Will order by a nested associated model's created_at simple association objects.
    [{model: Task, as: 'Task'}, {model: Project, as: 'Project'}, 'createdAt', 'DESC']
  ]
  
  // Will order by max age descending
  order: sequelize.literal('max(age) DESC')

  // Will order by max age ascending assuming ascending is the default order when direction is omitted
  order: sequelize.fn('max', sequelize.col('age'))

  // Will order by age ascending assuming ascending is the default order when direction is omitted
  order: sequelize.col('age')
})
```
