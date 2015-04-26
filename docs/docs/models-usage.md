## Data retrieval / Finders

Finder methods are designed to get data from the database&period; The returned data isn't just a plain object&comma; but instances of one of the defined classes&period; Check the next major chapter about instances for further information&period; But as those things are instances&comma; you can e&period;g&period; use the just describe expanded instance methods&period; So&comma; here is what you can do&colon;

### find - Search for one specific element in the database
```js
// search for known ids
Project.find(123).then(function(project) {
  // project will be an instance of Project and stores the content of the table entry
  // with id 123. if such an entry is not defined you will get null
})

// search for attributes
Project.find({ where: {title: 'aProject'} }).then(function(project) {
  // project will be the first entry of the Projects table with the title 'aProject' || null
})


Project.find({
  where: {title: 'aProject'},
  attributes: ['id', ['name', 'title']]
}).then(function(project) {
  // project will be the first entry of the Projects table with the title 'aProject' || null
  // project.title will contain the name of the project
})
```

### findOrCreate - Search for a specific element or create it if not available

The method `findOrCreate` can be used to check if a certain element already exists in the database&period; If that is the case the method will result in a respective instance&period; If the element does not yet exist&comma; it will be created.

Let's assume we have an empty database with a `User` model which has a `username` and a `job`.

```js
User
  .findOrCreate({where: {username: 'sdepold'}, defaults: {job: 'Technical Lead JavaScript'}})
  .spread(function(user, created) {
    console.log(user.get({
      plain: true
    }))
    console.log(created)

    /*
      {
        username: 'sdepold',
        job: 'Technical Lead JavaScript',
        id: 1,
        createdAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET),
        updatedAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET)
      }
      created: true
    */
  })
```

The code created a new instance&period; So when we already have an instance &period;&period;&period;
```js
User
  .create({ username: 'fnord', job: 'omnomnom' })
  .then(function() {
    User
      .findOrCreate({where: {username: 'fnord'}, defaults: {job: 'something else'}})
      .spread(function(user, created) {
        console.log(user.get({
          plain: true
        }))
        console.log(created)

        /*
          {
            username: 'fnord',
            job: 'omnomnom',
            id: 2,
            createdAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET),
            updatedAt: Fri Mar 22 2013 21: 28: 34 GMT + 0100(CET)
          }
          created: false
        */
      })
  })
```

&period;&period;&period; the existing entry will not be changed&period; See the `job` of the second user&comma; and the fact that created was false&period;

### findAndCountAll - Search for multiple elements in the database&comma; returns both data and total count

This is a convienience method that combines`findAll`&lpar;&rpar;and `count`&lpar;&rpar;&lpar;see below&rpar;&comma; this is useful when dealing with queries related to pagination where you want to retrieve data with a `limit` and `offset` but also need to know the total number of records that match the query&period;

The success handler will always receive an object with two properties&colon;

* `count` - an integer&comma; total number records &lpar;matching the where clause&rpar;
* `rows` - an array of objects&comma; the records &lpar;matching the where clause&rpar; within the limit&sol;offset range
```js
Project
  .findAndCountAll({
     where: {
        title: {
          $like: 'foo%'
        }
     },
     offset: 10,
     limit: 2
  })
  .then(function(result) {
    console.log(result.count);
    console.log(result.rows);
  });
```

The options &lsqb;object&rsqb; that you pass to`findAndCountAll`&lpar;&rpar;is the same as for`findAll`&lpar;&rpar;&lpar;described below&rpar;&period;

### findAll - Search for multiple elements in the database
```js
// find multiple entries
Project.findAll().then(function(projects) {
  // projects will be an array of all Project instances
})

// also possible:
Project.all().then(function(projects) {
  // projects will be an array of all Project instances
})

// search for specific attributes - hash usage
Project.findAll({ where: { name: 'A Project' } }).then(function(projects) {
  // projects will be an array of Project instances with the specified name
})

// search with string replacements
Project.findAll({ where: ["id > ?", 25] }).then(function(projects) {
  // projects will be an array of Projects having a greater id than 25
})

// search within a specific range
Project.findAll({ where: { id: [1,2,3] } }).then(function(projects) {
  // projects will be an array of Projects having the id 1, 2 or 3
  // this is actually doing an IN query
})

Project.findAll({
  where: {
    id: {
      $gt: 6,                // id > 6
      $gte: 6,               // id >= 6
      $lt: 10,               // id < 10
      $lte: 10,              // id <= 10
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
    },
    status: {
      $not: false,           // status NOT FALSE
    }
  }
})
```

### Complex filtering / OR / NOT queries

It's possible to do complex where queries with multiple levels of nested AND, OR and NOT conditions. In order to do that you can use `$or`, `$and` or `$not`:

```js
Project.find({
  where: {
    name: 'a project',
    $or: [
      { id: [1,2,3] },
      { id: { $gt: 10 } }
    ]
  }
})

Project.find({
  where: {
    name: 'a project',
    id: {
      $or: [
        [1,2,3],
        { $gt: 10 }
      ]
    }
  }
})
```

Both pieces of code code will generate the following:

```sql
SELECT *
FROM `Projects`
WHERE (
  `Projects`.`name` = 'a project'
   AND (`Projects`.`id` IN (1,2,3) OR `Projects`.`id` > 10)
)
LIMIT 1;
```

`$not` example:

```js
Project.find({
  where: {
    name: 'a project',
    $not: [
      { id: [1,2,3] },
      { array: { $contains: [3,4,5] } }
    ]
  }
});
```

Will generate:

```sql
SELECT *
FROM `Projects`
WHERE (
  `Projects`.`name` = 'a project'
   AND NOT (`Projects`.`id` IN (1,2,3) OR `Projects`.`array` @> ARRAY[1,2,3]::INTEGER[])
)
LIMIT 1;
```

### Manipulating the dataset with limit&comma; offset&comma; order and group

To get more relevant data&comma; you can use limit&comma; offset&comma; order and grouping&colon;

```js
// limit the results of the query
Project.findAll({ limit: 10 })

// step over the first 10 elements
Project.findAll({ offset: 10 })

// step over the first 10 elements, and take 2
Project.findAll({ offset: 10, limit: 2 })
```

The syntax for grouping and ordering are equal&comma; so below it is only explained with a single example for group&comma; and the rest for order&period; Everything you see below can also be done for group

```js
Project.findAll({order: 'title DESC'})
// yields ORDER BY title DESC

Project.findAll({group: 'name'})
// yields GROUP BY name
```

Notice how in the two examples above&comma; the string provided is inserted verbatim into the query&comma; i&period;e&period; column names are not escaped&period; When you provide a string to order &sol; group&comma; this will always be the case. If you want to escape column names&comma; you should provide an array of arguments&comma; even though you only want to order &sol; group by a single column

```js
something.find({
  order: [
    'name',
    // will return `name`
    'username DESC',
    // will return `username DESC` -- i.e. don't do it!
    ['username', 'DESC'],
    // will return `username` DESC
    sequelize.fn('max', sequelize.col('age')),
    // will return max(`age`)
    [sequelize.fn('max', sequelize.col('age')), 'DESC'],
    // will return max(`age`) DESC
    [sequelize.fn('otherfunction', sequelize.col('col1'), 12, 'lalala'), 'DESC'],
    // will return otherfunction(`col1`, 12, 'lalala') DESC
    [sequelize.fn('otherfunction', sequelize.fn('awesomefunction', sequelize.col('col'))), 'DESC']
    // will return otherfunction(awesomefunction(`col`)) DESC, This nesting is potentially infinite!
    [{ raw: 'otherfunction(awesomefunction(`col`))' }, 'DESC']
    // This won't be quoted, but direction will be added
  ]
})
```

To recap&comma; the elements of the order &sol; group array can be the following&colon;

* String - will be quoted
* Array - first element will be qouted&comma; second will be appended verbatim
* Object -
  * Raw will be added verbatim without quoting
  * Everything else is ignored&comma; and if raw is not set&comma; the query will fail
* Sequelize&period;fn and Sequelize&period;col returns functions and quoted cools

### Raw queries

Sometimes you might be expecting a massive dataset that you just want to display, without manipulation. For each row you select, Sequelize creates an instance with functions for updat, delete, get associations etc. If you have thousands of rows&comma; this might take some time&period; If you only need the raw data and don't want to update anything&comma; you can do like this to get the raw data&period;

```js
// Are you expecting a masssive dataset from the DB,
// and don't want to spend the time building DAOs for each entry?
// You can pass an extra query option to get the raw data instead:
Project.findAll({ where: ... }, { raw: true })
```

### count - Count the occurences of elements in the database

There is also a method for counting database objects&colon;

```js
Project.count().then(function(c) {
  console.log("There are " + c + " projects!")
})

Project.count({ where: ["id > ?", 25] }).then(function(c) {
  console.log("There are " + c + " projects with an id greater than 25.")
})
```

### max - Get the greatest value of a specific attribute within a specific table

And here is a method for getting the max value of an attribute&colon;f

```js
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.max('age').then(function(max) {
  // this will return 40
})

Project.max('age', { where: { age: { lt: 20 } } }).then(function(max) {
  // will be 10
})
```

### min - Get the least value of a specific attribute within a specific table

And here is a method for getting the min value of an attribute&colon;

```js
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.min('age').then(function(min) {
  // this will return 5
})

Project.min('age', { where: { age: { $gt: 5 } } }).then(function(min) {
  // will be 10
})
```

### sum - Sum the value of specific attributes

In order to calculate the sum over a specific column of a table, you can
use the `sum` method.

```js
/*
  Let's assume 3 person objects with an attribute age.
  The first one is 10 years old,
  the second one is 5 years old,
  the third one is 40 years old.
*/
Project.sum('age').then(function(sum) {
  // this will return 55
})

Project.sum('age', { where: { age: { $gt: 5 } } }).then(function(sum) {
  // wil be 50
})
```

## Eager loading

When you are retrieving data from the database there is a fair chance that you also want to get associations with the same query - this is called eager loading. The basic idea behind that, is the use of the attribute `include` when you are calling `find` or `findAll`. Lets assume the following setup:

```js
var User = sequelize.define('User', { name: Sequelize.STRING })
  , Task = sequelize.define('Task', { name: Sequelize.STRING })
  , Tool = sequelize.define('Tool', { name: Sequelize.STRING })

Task.belongsTo(User)
User.hasMany(Task)
User.hasMany(Tool, { as: 'Instruments' })

sequelize.sync().done(function() {
  // this is where we continue ...
})
```

OK&period; So&comma; first of all&comma; let's load all tasks with their associated user&period;

```js
Task.findAll({ include: [ User ] }).then(function(tasks) {
  console.log(JSON.stringify(tasks))

  /*
    [{
      "name": "A Task",
      "id": 1,
      "createdAt": "2013-03-20T20:31:40.000Z",
      "updatedAt": "2013-03-20T20:31:40.000Z",
      "UserId": 1,
      "User": {
        "name": "John Doe",
        "id": 1,
        "createdAt": "2013-03-20T20:31:45.000Z",
        "updatedAt": "2013-03-20T20:31:45.000Z"
      }
    }]
  */
})
```

Notice that the accessor is singular as the association is one-to-something&period;

Next thing&colon; Loading of data with many-to-something associations&excl;

```js
User.findAll({ include: [ Task ] }).then(function(users) {
  console.log(JSON.stringify(users))

  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "Tasks": [{
        "name": "A Task",
        "id": 1,
        "createdAt": "2013-03-20T20:31:40.000Z",
        "updatedAt": "2013-03-20T20:31:40.000Z",
        "UserId": 1
      }]
    }]
  */
})
```

Notice that the accessor is plural&period; This is because the association is many-to-something&period;

If an association is aliased (using the `as` option), you must specify this alias when including the model&period; Notice how the user's `Tool`s are aliased as `Instruments` above&period; In order to get that right you have to specify the model you want to load&comma; as well as the alias&colon;

```js
User.findAll({ include: [{ model: Tool, as: 'Instruments' }] }).then(function(users) {
  console.log(JSON.stringify(users))

  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "Instruments": [{
        "name": "Toothpick",
        "id": 1,
        "createdAt": null,
        "updatedAt": null,
        "UserId": 1
      }]
    }]
  */
})
```

### Including everything

To include all attributes, you can pass a single object with `all: true`:

```js
User.findAll({ include: [{ all: true }]});
```

### Ordering Eager Loaded Associations

In the case of a one-to-many relationship.

```js
Company.findAll({ include: [ Division ], order: [ [ Division, 'name' ] ] });
Company.findAll({ include: [ Division ], order: [ [ Division, 'name', 'DESC' ] ] });
Company.findAll({
  include: [ { model: Division, as: 'Div' } ],
  order: [ [ { model: Division, as: 'Div' }, 'name' ] ]
});
Company.findAll({
  include: [ { model: Division, include: [ Department ] } ],
  order: [ [ Division, Department, 'name' ] ]
});
```

In the case of many-to-many joins, you are also able to sort by attributes in the through table.

```js
Company.findAll({
  include: [ { model: Division, include: [ Department ] } ],
  order: [ [ Division, DepartmentDivision, 'name' ] ]
});
```

### Nested eager loading
You can used nested eager loading to load all related models of a related model: 
```js
User.findAll({
  include: [
    {model: Tool, as: 'Instruments', include: [
      {model: Teacher, include: [ /* etc */]}
    ]}
  ]
}).then(function(users) {
  console.log(JSON.stringify(users))

  /*
    [{
      "name": "John Doe",
      "id": 1,
      "createdAt": "2013-03-20T20:31:45.000Z",
      "updatedAt": "2013-03-20T20:31:45.000Z",
      "Instruments": [{ // 1:M and N:M association
        "name": "Toothpick",
        "id": 1,
        "createdAt": null,
        "updatedAt": null,
        "UserId": 1,
        "Teacher": { // 1:1 association
          "name": "Jimi Hendrix"
        }
      }]
    }]
  */
})
```

Include all also supports nested loading: 

```js
User.findAll({ include: [{ all: true, nested: true }]});
```
