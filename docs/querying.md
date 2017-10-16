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

Similarly, it's also possible to remove a selected few attributes:

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

It's also possible to generate complex AND/OR conditions by nesting sets of `or` and `and` `Operators`.

### Basics
```js
const Op = Sequelize.Op;

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
      [Op.ne]: null
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

Sequelize exposes symbol operators that can be used for to create more complex comparisons -
```js
const Op = Sequelize.Op

[Op.and]: {a: 5}           // AND (a = 5)
[Op.or]: [{a: 5}, {a: 6}]  // (a = 5 OR a = 6)
[Op.gt]: 6,                // > 6
[Op.gte]: 6,               // >= 6
[Op.lt]: 10,               // < 10
[Op.lte]: 10,              // <= 10
[Op.ne]: 20,               // != 20
[Op.eq]: 3,                // = 3
[Op.not]: true,            // IS NOT TRUE
[Op.between]: [6, 10],     // BETWEEN 6 AND 10
[Op.notBetween]: [11, 15], // NOT BETWEEN 11 AND 15
[Op.in]: [1, 2],           // IN [1, 2]
[Op.notIn]: [1, 2],        // NOT IN [1, 2]
[Op.like]: '%hat',         // LIKE '%hat'
[Op.notLike]: '%hat'       // NOT LIKE '%hat'
[Op.iLike]: '%hat'         // ILIKE '%hat' (case insensitive) (PG only)
[Op.notILike]: '%hat'      // NOT ILIKE '%hat'  (PG only)
[Op.regexp]: '^[h|a|t]'    // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
[Op.notRegexp]: '^[h|a|t]' // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
[Op.iRegexp]: '^[h|a|t]'    // ~* '^[h|a|t]' (PG only)
[Op.notIRegexp]: '^[h|a|t]' // !~* '^[h|a|t]' (PG only)
[Op.like]: { [Op.any]: ['cat', 'hat']}
                       // LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
[Op.overlap]: [1, 2]       // && [1, 2] (PG array overlap operator)
[Op.contains]: [1, 2]      // @> [1, 2] (PG array contains operator)
[Op.contained]: [1, 2]     // <@ [1, 2] (PG array contained by operator)
[Op.any]: [2,3]            // ANY ARRAY[2, 3]::INTEGER (PG only)

[Op.col]: 'user.organization_id' // = "user"."organization_id", with dialect specific column identifiers, PG in this example
```

#### Range Operators

Range types can be queried with all supported operators.

Keep in mind, the provided range value can
[define the bound inclusion/exclusion](/manual/tutorial/models-definition.html#range-types)
as well.

```js
// All the above equality and inequality operators plus the following:

[Op.contains]: 2           // @> '2'::integer (PG range contains element operator)
[Op.contains]: [1, 2]      // @> [1, 2) (PG range contains range operator)
[Op.contained]: [1, 2]     // <@ [1, 2) (PG range is contained by operator)
[Op.overlap]: [1, 2]       // && [1, 2) (PG range overlap (have points in common) operator)
[Op.adjacent]: [1, 2]      // -|- [1, 2) (PG range is adjacent to operator)
[Op.strictLeft]: [1, 2]    // << [1, 2) (PG range strictly left of operator)
[Op.strictRight]: [1, 2]   // >> [1, 2) (PG range strictly right of operator)
[Op.noExtendRight]: [1, 2] // &< [1, 2) (PG range does not extend to the right of operator)
[Op.noExtendLeft]: [1, 2]  // &> [1, 2) (PG range does not extend to the left of operator)
```

#### Combinations
```js
const Op = Sequelize.Op;

{
  rank: {
    [Op.or]: {
      [Op.lt]: 1000,
      [Op.eq]: null
    }
  }
}
// rank < 1000 OR rank IS NULL

{
  createdAt: {
    [Op.lt]: new Date(),
    [Op.gt]: new Date(new Date() - 24 * 60 * 60 * 1000)
  }
}
// createdAt < [timestamp] AND createdAt > [timestamp]

{
  [Op.or]: [
    {
      title: {
        [Op.like]: 'Boat%'
      }
    },
    {
      description: {
        [Op.like]: '%boat%'
      }
    }
  ]
}
// title LIKE 'Boat%' OR description LIKE '%boat%'
```

#### Operators Aliases
Sequelize allows setting specific strings as aliases for operators -
```js
const Op = Sequelize.Op;
const operatorsAliases = {
  $gt: Op.gt
}
const connection = new Sequelize(db, user, pass, { operatorsAliases })

[Op.gt]: 6 // > 6
$gt: 6 // same as using Op.gt (> 6)
```


#### Operators security
Using Sequelize without any aliases improves security.
Some frameworks automatically parse user input into js objects and if you fail to sanitize your input it might be possible to inject an Object with string operators to Sequelize.

Not having any string aliases will make it extremely unlikely that operators could be injected but you should always properly validate and sanitize user input.

For backward compatibility reasons Sequelize sets the following aliases by default -
$eq, $ne, $gte, $gt, $lte, $lt, $not, $in, $notIn, $is, $like, $notLike, $iLike, $notILike, $regexp, $notRegexp, $iRegexp, $notIRegexp, $between, $notBetween, $overlap, $contains, $contained, $adjacent, $strictLeft, $strictRight, $noExtendRight, $noExtendLeft, $and, $or, $any, $all, $values, $col

Currently the following legacy aliases are also set but are planned to be fully removed in the near future -
ne, not, in, notIn, gte, gt, lte, lt, like, ilike, $ilike, nlike, $notlike, notilike, .., between, !.., notbetween, nbetween, overlap, &&, @>, <@

For better security it is highly advised to use `Sequelize.Op` and not depend on any string alias at all. You can limit alias your application will need by setting `operatorsAliases` option, remember to sanitize user input especially when you are directly passing them to Sequelize methods.

```js
const Op = Sequelize.Op;

//use sequelize without any operators aliases
const connection = new Sequelize(db, user, pass, { operatorsAliases: false });

//use sequelize with only alias for $and => Op.and
const connection2 = new Sequelize(db, user, pass, { operatorsAliases: { $and: Op.and } });
```

Sequelize will warn you if your using the default aliases and not limiting them
if you want to keep using all default aliases (excluding legacy ones) without the warning you can pass the following operatorsAliases option -

```js
const Op = Sequelize.Op;
const operatorsAliases = {
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col
};

const connection = new Sequelize(db, user, pass, { operatorsAliases });
```

### JSONB

JSONB can be queried in three different ways.

#### Nested object
```js
{
  meta: {
    video: {
      url: {
        [Op.ne]: null
      }
    }
  }
}
```

#### Nested key
```js
{
  "meta.audio.length": {
    [Op.gt]: 20
  }
}
```

#### Containment
```js
{
  "meta": {
    [Op.contains]: {
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

## CTEs and Recursive Queries

CTEs (Common Table Expressions) are special expressions that preceded a query. They create a named expression that can be referenced later in a query. Some dialects allow a CTE to perform a recursive query, a query that repeats itself as long as it is able to. There may be many CTEs with a single query, and each CTE can build on the results of the one that came before.

### Motivating example

Here is a simple example of using a non-recursive query as a filter
First, we set up some data 

```js 
Bank.create({ name: 'Tri-County Bank', amount: 10000 }),
Bank.create({ name: 'Valley Bank', amount: 30000 }),
Bank.create({ name: 'Hill City Bank', amount: 50000 })
```
then using a CTE as a filter, we can perform a simple where with the cteSelect and merely gather the results in the main query
```js
return Bank.findAll({
    cte: [{
        name: "greaterThan20kBanks",
        initial: {
            where: {
                amount: {
                    [Op.get]: 20000
                }
            }
        }
    }],
    cteSelect: "greaterThan20kBanks",
}).then((banks) => {
    banks.forEach(bank => {
        console.log(`${bank.name} : $${bank.amount}`);
    });
});
```

which will give us the output

```
Valley Bank : $30000
Hill City Bank : $50000
```

This example could have easily be done by a `where` on the main query. However, CTEs have many features like chaining and recursive queries that give them unique abilities when used to query data.

### CTEs in a findAll

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
                    timeWorked: { [Op.lt]: 40 }
                },
                cte: {
                    depth: { [Op.lt]: 10 }   
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
