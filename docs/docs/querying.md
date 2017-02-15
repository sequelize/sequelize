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
[define the bound inclusion/exclusion](models-definition/#range-types)
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
something.findOne({
  order: [
    // Will escape username and validate DESC against a list of valid direction parameters
    ['username', 'DESC'],

    // Will order by max(age)
    sequelize.fn('max', sequelize.col('age')),

    // Will order by max(age) DESC
    [sequelize.fn('max', sequelize.col('age')), 'DESC'],

    // Will order by  otherfunction(`col1`, 12, 'lalala') DESC
    [sequelize.fn('otherfunction', sequelize.col('col1'), 12, 'lalala'), 'DESC'],

    // Will order by name on an associated User
    [User, 'name', 'DESC'],

    // Will order by name on an associated User aliased as Friend
    [{model: User, as: 'Friend'}, 'name', 'DESC'],

    // Will order by name on a nested associated Company of an associated User
    [User, Company, 'name', 'DESC'],
  ]
  // Will order by max age descending
  order: sequelize.literal('max(age) DESC')

  // Will order by max age ascencding assuming ascencding is the default order when direction is omitted
  order: sequelize.fn('max', sequelize.col('age'))

  // Will order by age ascencding assuming ascencding is the default order when direction is omitted
  order: sequelize.col('age')
})
```

## CTEs and Recursive Queries

CTEs (Common Table Expressions) are special expressions that preceded a query. They create a named expression that can be referenced later in a query. Some dialects allow a CTE to perform a recursive query, a query that repeats itself as long as it is able to. There may be many CTEs with a single query, and each CTE can build on the results of the one that came before.


`cte` takes an array of objects that each describe a common table expression or CTE. CTEs run before the main query and can be made recursive.

```js
something.findAll({
    cte: [{
        name: 'a',
        initial: {
            where: {
                name: 'Jane'
            }
        },
        recursive: {
            next: 'friend'
        },
        limit: 20
    }]
    cteSelect: 'a'
}
```

### Creating a CTE

CTEs are usually based on the model being queried. This happens automatically, but can be controlled through `useModel` and `model`.

```js
cte: [{
    name: 'b',
    model: User,
    useModel: true
}]
```

When a CTE uses a model all of the attributes from the model will be included with the CTE. A CTE object also takes `cteAttributes`, an array of strings that define additional attributes.
 
When `cteAttributes` is given a definition of each attribute must be given in both the `initial` and `recursive` steps.

### Filling a CTE

The CTE object has two properties to describe what data should fill the CTE: `initial` and `recursive`. Initial is required and describes the data the CTE begins with. If a CTE is based off a model a 
where is usually used to limit which rows from the model are included. 

```js 

cte: [{
    name: 'c',
    initial: {
        where: {
            name: 'Jane'
        }
}]
        
```

The recursive property is a little more complicated and requires a quick explanation of how it actually works.
1. The initial query is added to a queue
2. A row is pulled from the queue
3. The single row is treated as the only row in a table, which is used in the recursive query
4. The results of the recursive query are placed back into the queue and the single row goes into the results
5. Steps 1 through 4 continue until the queue is empty. 

If `order` is given to the cte, it is used to determine which row will be pulled from the queue. If `order` is not given the queue generally acts like a FIFO queue, but that behavior is not guaranteed. If order is important make sure you find a way to enforce it through `order`.

The recursive property follows the same form as the initial property, with two exceptions. A property, `next`, is given to make recursive queries that follow associations easy. `next` is a string that is the name of an association a model has with itself.

```js 
User.belongsTo(User, { as: 'Boss' })

User.findAll({
    cte: [{
        ...
        recursive: {
            next: 'Boss'
        }
    }]
});
```
   
The other difference is a that the `where` property must be split into sub-properties: one that applies to the model and one that applies to the CTE.

```js
User.findAll({
    cte: [{
        ...
        recursive: {
            where: {
                model: {
                    timeWorked: { $lt: 40 }
                },
                cte: {
                    depth: { $lt: 10 }   
                }
            }
        }
    ]} 
});
```

It is possible to have infinite recursion! Always make sure the recursive statement has a `where`, or the overall CTE has an `limit`.

### CTE Attributes

If a CTE has additional attributes each one must be defined on both the initial property and the recursive property (if it exists).

An attribute is defined though a plain object consisting of one of the following properties, or a value (number, string, value). If the property is an array each element is either a plain objects with one property or a value.

| Property | Type | Description |
| -------- | ---- | ----------- |
| `$add` | Array | adds each element of the array to the preceding one, left-to-right |
| `$sub` | Array | subtracts each element of the array from the preceding one, left-to-right |
| `$mul` | Array | multiples each element of the array to the preceding one, left-to-right |
| `$div` | Array | divides each element of the array from the preceding one, left-to-right |
| `$model` | String | returns the value of the given attribute from the model |
| `$cte` | String | returns the value of the given attribute from the cte |
| `$col` | String | shorthand for `sequelize.col` |

```js
initial: {
    name: 'd',
    depth: 0
},
recursive: {
    depth: {
        $add: [{ $cte: 'depth', 1}]
    }
}
```


### CTEs in the overall results

To actually use the results of a CTE in the results of a query there are some helpful options. The most general way to use the results would be to add a `where` to the main query with a CTE through `Sequelize.col()`.

The other way is through a new option property, `cteSelect`. If the CTE (whose name is given as a string to cteSelect) is based off of the same model an inner join is performed between the CTE and the main query results. 
In addition, `cteAttributes` specifies an array of CTE attributes that should also be returned on each object. 

For a shortcut if you have defined one cte it will automatically be used as the `cteSelect`. Defining `cteSelect` will disable this behavior and defining it as `null` will prevent any automatic join from occuring. 


### CTE support by dialect

Currently MySQL and MariaDB have no support for CTEs. If `cte` is used with either dialect it will be ignored. Postgres does not support the use of `order`, `limit`, or `offset` in recursive queries. MSSQL CTE syntax is different enough that it is not currently supported.
