

<a name="DAOFactory" />

### DAOFactory

A DAOFactory represents a table in the database. Sometimes you might also see it refererred to as model, or simply as factory. This class should _not_ be instantiated directly, It is created using `sequelize.define`, and already created models can be loaded using `sequelize.import`

### Mixes:

* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-{Hooks}">Hooks</a>

* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-{Assocations}">Assocations</a>

* <a href="http://nodejs.org/api/events.html#events_class_events_eventemitter">http://nodejs.org/api/events.html#events_class_events_eventemitter</a>

### Members:
* <a href="#attributes">attributes</a>
* <a href="#sequelize">sequelize</a>
* <a href="#QueryInterface">QueryInterface</a>
* <a href="#QueryGenerator">QueryGenerator</a>
* <a href="#sync">sync()</a>
* <a href="#drop">drop([options])</a>
* <a href="#scope">scope(option*)</a>
* <a href="#findAll">findAll([options], [queryOptions])</a>
* <a href="#find">find([options], [queryOptions])</a>
* <a href="#aggregate">aggregate(field, aggregateFunction, [options])</a>
* <a href="#findAndCountAll">findAndCountAll([findOptions], [queryOptions])</a>
* <a href="#max">max(field, options)</a>
* <a href="#min">min(field, options)</a>
* <a href="#sum">sum(field, options)</a>
* <a href="#build">build(values, [options])</a>
* <a href="#create">create(values, [options])</a>
* <a href="#findOrInitialize">findOrInitialize(where, [defaults], [options])</a>
* <a href="#findOrCreate">findOrCreate(where, [defaults], [options])</a>
* <a href="#bulkCreate">bulkCreate(records, [options])</a>
* <a href="#destroy">destroy([where], [options])</a>
* <a href="#update">update(attrValueHash, where, options)</a>
* <a href="#describe">describe()</a>

------

<a name="attributes" />

### attributes

Return a hash of the attributes of the table. Keys are attributes, are values are the SQL representation of their type

------

<a name="sequelize" />

### sequelize

A reference to the sequelize instance

------

<a name="QueryInterface" />

### QueryInterface

A reference to the query interface

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-QueryInterface">QueryInterface</a>

------

<a name="QueryGenerator" />

### QueryGenerator

A reference to the query generator

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-QueryGenerator">QueryGenerator</a>

------

<a name="sync" />

### sync()

Sync this DAOFactory to the DB, that is create the table.

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#sync">Sequelize#sync for options</a>

#### Return:

* **EventEmitter** 

------

<a name="drop" />

### drop([options])

Drop the table represented by this Model

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.cascade=false]</td>
<td>Boolean</td>
<td>Also drop all objects depending on this table, such as views. Only works in postgres</td>
</tr>

</table>

------

<a name="scope" />

### scope(option*)

Apply a scope created in `define` to the model. First let's look at how to create scopes:
```js
var Model = sequelize.define('model', {
  attributes 
}, {
  defaultScope: {
    where: {
      username: 'dan'
    },
    limit: 12
  },
  scopes: {
    isALie: {
      where: {
        stuff: 'cake'
      }
    },
    complexFunction: function(email, accessLevel) {
      return {
        where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
      }
    },
  }
})
```
Now, since you defined a default scope, every time you do Model.find, the default scope is appended to your query. Here's a couple of examples:
```js
Model.findAll() // WHERE username = 'dan'
Model.findAll({ where: { age: { gt: 12 } } }) // WHERE age > 12 AND username = 'dan'
``` 

To invoke scope functions you can do:
```js
Model.scope({ method: ['complexFunction' 'dan@sequelize.com', 42]}) 
// WHERE email like 'dan@sequelize.com%' AND access_level >= 42
```

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>option*</td>
<td>Array|Object|String|null</td>
<td>The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default . </td>
</tr>

</table>

#### Return:

* **DAOFactory** A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.

------

<a name="findAll" />

### findAll([options], [queryOptions])

Search for multiple instances

__Simple search using AND and =__
```js
Model.find({
  where: {
    attr1: 42,
    attr2: 'cake'
  }
})
```
```sql
WHERE attr1 = 42 AND attr2 = 'cake'
```

__Using greater than, less than etc.___
```js

Model.find({
  where: {
    attr1: {
      gt: 50
    },
    attr2: {
      lte: 45
    },
    attr3: {
      in: [1,2,3]
    },
    attr4: {
      ne: 5
    }
  }
}) 
```
```sql
WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
```
Possible options are: `gt, gte, lt, lte, ne, between/.., nbetween/notbetween/!.., in, not, like, nlike/notlike` 

__Queries using OR__
```js
Model.find({
  where: Sequelize.and(
    { name: 'a project' },
    Sequelize.or(
      { id: [1,2,3] },
      { id: { gt: 10 } }
    )
  )
})
``` 
```sql
WHERE name = 'a project' AND (id` IN (1,2,3) OR id > 10)
```

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#query">Sequelize#query</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options]</td>
<td>Object</td>
<td>A hash of options to describe the scope of the search</td>
</tr>

<tr>
<td>[options.where]</td>
<td>Object</td>
<td>A hash of attributes to describe your search. See above for examples.</td>
</tr>

<tr>
<td>[options.attributes]</td>
<td>Array<String></td>
<td>A list of the attributes that you want to select</td>
</tr>

<tr>
<td>[options.include]</td>
<td>Array<Object|DAOFactory></td>
<td>A list of associations to eagerly load. Supported is either { include: [ DaoFactory1, DaoFactory2, ...] } or { include: [ { model: DaoFactory1, as: 'Alias' } ] }. When using the object form, you can also specify `attributes`, `where` to limit the relations and their columns, and `include` to load further nested relations</td>
</tr>

<tr>
<td>[options.order]</td>
<td>String|Array|Sequelize.fn</td>
<td>Specifies an ordering. If a string is provided, it will be esacped. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.</td>
</tr>

<tr>
<td>[options.limit]</td>
<td>Number</td>
<td></td>
</tr>

<tr>
<td>[options.offset]</td>
<td>Number</td>
<td></td>
</tr>

<tr>
<td>[queryOptions]</td>
<td>Object</td>
<td>set the query options, e.g. raw, specifying that you want raw data instead of built DAOs. See sequelize.query for options</td>
</tr>

<tr>
<td>[queryOptions.transaction]</td>
<td>Transaction</td>
<td></td>
</tr>

<tr>
<td>[queryOptions.raw]</td>
<td>Boolean</td>
<td>Returns the results as raw JS objects instead of DAO instances</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, an array of DAOs will be returned to the success listener

------

<a name="find" />

### find([options], [queryOptions])

Search for an instance.

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#findAll">DAOFactory#findAll for an explanation of options and queryOptions</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[options]</td>
<td>Object|Number</td>
<td>A hash of options to describe the scope of the search, or a number to search by id.</td>
</tr>

<tr>
<td>[queryOptions]</td>
<td>Object</td>
<td></td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, a DAO will be returned to the success listener

------

<a name="aggregate" />

### aggregate(field, aggregateFunction, [options])

Run an aggregation method on the specified field

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>field</td>
<td>String</td>
<td>The field to aggregate over. Can be a field name or *</td>
</tr>

<tr>
<td>aggregateFunction</td>
<td>String</td>
<td>The function to use for aggregation, e.g. sum, max etc.</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td>Query options. See sequelize.query for full options</td>
</tr>

<tr>
<td>[options.dataType]</td>
<td>DataType|String</td>
<td>The type of the result. If field is a field in the DAO, the default will be the type of that field, otherwise defaults to float.</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, the result of the aggregation function will be returned to the success listener

------

<a name="findAndCountAll" />

### findAndCountAll([findOptions], [queryOptions])

Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very usefull for paging

```js
Model.findAndCountAll({
  where: ...,
  limit: 12,
  offset: 12
}).success(function (result) {
       // result.rows will contain rows 13 through 24, while result.count will return the total number of rows that matched your query
})
```

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#findAll">DAOFactory#findAll for a specification of find and query options </a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[findOptions]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[queryOptions]</td>
<td>Object</td>
<td></td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, an object containing rows and count will be returned

------

<a name="max" />

### max(field, options)

Find the maximum value of field

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#aggregate">DAOFactory#aggregate for options</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>field</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>options</td>
<td>Object</td>
<td></td>
</tr>

</table>

------

<a name="min" />

### min(field, options)

Find the minimum value of field

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#aggregate">DAOFactory#aggregate for options</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>field</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>options</td>
<td>Object</td>
<td></td>
</tr>

</table>

------

<a name="sum" />

### sum(field, options)

Find the sun of field

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAOFactory#aggregate">DAOFactory#aggregate for options</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>field</td>
<td>String</td>
<td></td>
</tr>

<tr>
<td>options</td>
<td>Object</td>
<td></td>
</tr>

</table>

------

<a name="build" />

### build(values, [options])

Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.
    

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>values</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.raw=false]</td>
<td>Boolean</td>
<td>If set to true, values will ignore field and virtual setters.</td>
</tr>

<tr>
<td>[options.isNewRecord=true]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[options.isDirty=true]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[options.include]</td>
<td>Array</td>
<td>an array of include options - Used to build prefetched/included model instances</td>
</tr>

</table>

#### Return:

* **DAO** 

------

<a name="create" />

### create(values, [options])

Builds a new model instance and calls save on it.
    

See:
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAO#build">DAO#build</a>
* <a href="https://github.com/sequelize/sequelize/wiki/API-Reference-DAO#save">DAO#save</a>

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>values</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.raw=false]</td>
<td>Boolean</td>
<td>If set to true, values will ignore field and virtual setters.</td>
</tr>

<tr>
<td>[options.isNewRecord=true]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[options.isDirty=true]</td>
<td>Boolean</td>
<td></td>
</tr>

<tr>
<td>[options.fields]</td>
<td>Array</td>
<td>If set, only columns matching those in fields will be saved</td>
</tr>

<tr>
<td>[options.include]</td>
<td>Array</td>
<td>an array of include options - Used to build prefetched/included model instances</td>
</tr>

<tr>
<td>[options.transaction]</td>
<td>Transaction</td>
<td></td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, the DAO will be return to the success listener

------

<a name="findOrInitialize" />

### findOrInitialize

Find a row that matches the query, or build (but don't save) the row if none is found

**Deprecated**

The syntax is due for change, in order to make `where` more consistent with the rest of the API

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>where</td>
<td>Object</td>
<td>A hash of search attributes. Note that this method differs from finders, in that the syntax is { attr1: 42 } and NOT { where: { attr1: 42}}. This is subject to change in 2.0</td>
</tr>

<tr>
<td>[defaults]</td>
<td>Object</td>
<td>Default values to use if building a new instance</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td>Options passed to the find call</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, the DAO will be return to the success listener

------

<a name="findOrCreate" />

### findOrCreate(where, [defaults], [options])

Find a row that matches the query, or build and save the row if none is found

**Deprecated**

The syntax is due for change, in order to make `where` more consistent with the rest of the API

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>where</td>
<td>Object</td>
<td>A hash of search attributes. Note that this method differs from finders, in that the syntax is { attr1: 42 } and NOT { where: { attr1: 42}}. This is subject to change in 2.0</td>
</tr>

<tr>
<td>[defaults]</td>
<td>Object</td>
<td>Default values to use if creating a new instance</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td>Options passed to the find and create calls</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, the DAO will be return to the success listener

------

<a name="bulkCreate" />

### bulkCreate(records, [options])

Create and insert multiple instances in bulk

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>records</td>
<td>Array</td>
<td>List of objects (key/value pairs) to create instances from</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.fields]</td>
<td>Array</td>
<td>Fields to insert (defaults to all fields)</td>
</tr>

<tr>
<td>[options.validate=false]</td>
<td>Boolean</td>
<td>Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation</td>
</tr>

<tr>
<td>[options.hooks=false]</td>
<td>Boolean</td>
<td>Run before / after bulkCreate hooks?</td>
</tr>

<tr>
<td>[options.ignoreDuplicates=false]</td>
<td>Boolean</td>
<td>Ignore duplicate values for primary keys? (not supported by postgres)</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. The success` handler is not passed any arguments. To obtain DAOs for the newly created values, you will need to query for them again. This is because MySQL and SQLite do not make it easy to obtain back automatically generated IDs and other default values in a way that can be mapped to multiple records

------

<a name="destroy" />

### destroy([where], [options])

Delete multiple instances

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>[where]</td>
<td>Object</td>
<td>Options to describe the scope of the search.</td>
</tr>

<tr>
<td>[options]</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.hooks]</td>
<td>Boolean</td>
<td>If set to true, destroy will find all records within the where parameter and will execute before/afterDestroy hooks on each row</td>
</tr>

<tr>
<td>[options.limit]</td>
<td>Number</td>
<td>How many rows to delete</td>
</tr>

<tr>
<td>[options.truncate]</td>
<td>Boolean</td>
<td>If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored</td>
</tr>

</table>

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`.

------

<a name="update" />

### update(attrValueHash, where, options)

Update multiple instances

#### Params: 
<table>
<thead>
<th>Name</th><th>Type</th><th>Description</th>
</thead>

<tr>
<td>attrValueHash</td>
<td>Object</td>
<td>A hash of fields to change and their new values</td>
</tr>

<tr>
<td>where</td>
<td>Object</td>
<td>Options to describe the scope of the search. Note that these options are not wrapped in a { where: ... } is in find / findAll calls etc. This is probably due to change in 2.0</td>
</tr>

<tr>
<td>options</td>
<td>Object</td>
<td></td>
</tr>

<tr>
<td>[options.validate=true]</td>
<td>Boolean</td>
<td>Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation</td>
</tr>

<tr>
<td>[options.hooks=false]</td>
<td>Boolean</td>
<td>Run before / after bulkUpdate hooks?</td>
</tr>

</table>

#### Return:

* **EventEmitter** A promise which fires `success`, `error` and `sql`.

------

<a name="describe" />

### describe()

Run a describe query on the table

#### Return:

* **EventEmitter** Fires `success`, `error` and `sql`. Upon success, a hash of attributes and their types will be returned

------

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on [IRC](irc://irc.freenode.net/#sequelizejs), open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [markdox](https://github.com/cbou/markdox)_

_This documentation was automagically created on Tue Mar 04 2014 21:54:16 GMT+0100 (CET)_

