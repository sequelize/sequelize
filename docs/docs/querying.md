## Where

Whether you are querying with findAll/find or doing bulk updates/destroys you can pass a `where` object to filter the query.

`where` generally takes an object from attribute:value pairs, where value can be primitives for equality matches or keyed objects for other operators.

It's also possible to generate complex AND/OR conditions by nesting sets of `$or` and `$and`.

### Basics
```
Post.findAll({
  where: {
    authorId: 2
  }
});
// SELECT * FROM post WHERE authorId = 2

Post.findAll({
  where: {
    authorId: 12,
    status: active
  }
});
// SELECT * FROM post WHERE authorId = 12

Post.destroy({
  where: {
    status: 'inactive'
  }
});
// DELETE FROM post WHERE status = 'inactive';

Post.update({
  deletedAt: null,
}, {
  where: {
    deletedAt: {
      $ne: null
    }
  }
});
// UPDATE post SET updatedAt = null WHERE updatedAt NOT NULL;
```

### Operators

```js
$gt: 6,                // id > 6
$gte: 6,               // id >= 6
$lt: 10,               // id < 10
$lte: 10,              // id
$ne: 20,               // id != 20
$between: [6, 10],     // BETWEEN 6 AND 10
$notBetween: [11, 15], // NOT BETWEEN 11 AND 15
$in: [1, 2],           // IN [1, 2]
$like: '%hat',         // LIKE '%hat'
$notLike: '%hat'       // NOT LIKE '%hat'
$iLike: '%hat'         // ILIKE '%hat' (case insensitive)
$notILike: '%hat'      // NOT ILIKE '%hat'
$overlap: [1, 2]       // && [1, 2] (PG array overlap operator)
$contains: [1, 2]      // @> [1, 2] (PG array contains operator)
$contained: [1, 2]     // <@ [1, 2] (PG array contained by operator)
$any: [2,3]            // ANY ARRAY[2, 3]::INTEGER
```

### Combinations
```js
{
  rank: {
    $or: {
      $lt: 100,
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

`order` takes an array of items to order the query by. Generally you will want to use a tuple/array of either attribute, direction or just direction to ensure proper escaping.

```js
something.find({
  order: [
    // Will escape username and validate DESC against a list of valid direction parameters
    ['username', 'DESC'],

    // Will order by max(age)
    sequelize.fn('max', sequelize.col('age')),

    // Will order by max(age) DESC
    [sequelize.fn('max', sequelize.col('age')), 'DESC'],

    // Will order by  otherfunction(`col1`, 12, 'lalala') DESC    
    [sequelize.fn('otherfunction', sequelize.col('col1'), 12, 'lalala'), 'DESC'],

    // Both the following statements will be treated literally so should be treated with care
    'name',
    'username DESC'
  ]
})
```