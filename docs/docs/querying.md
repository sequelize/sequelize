## Where
Whether you are querying with findAll/find or doing bulk updates/destroys you can pass a `where` object to filter the query.

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
$overlap: [1, 2]       // && [1, 2]Post.findAll({
  where: {
    authorId: 2
  }
});
// SELECT * FROM post WHERE authorId = 2 (PG array overlap operator)
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
// limit the results of the query
Project.findAll({ limit: 10 })

// step over the first 10 elements
Project.findAll({ offset: 10 })

// step over the first 10 elements, and take 2
Project.findAll({ offset: 10, limit: 2 })
```