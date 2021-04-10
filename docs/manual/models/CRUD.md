# CRUD w/ Models

Now that we've defined our models
All the query helpers return promises, so either use the `then`/`catch` pattern or the `async`/`await` pattern.

> GOTCHA - you can't just call `user.fullName` on the result like you might expect. You have to add `raw: true` to the query and then access it like this: `user[0].fullName`.

We'll include our models into any file using this line of code:

```js
const models  = require('../db/models');
```

## Index

`.findAll()` with `where`

```js
models.User.findAll({ where: { name: "Betty" } }).then(users => {
  let bettys = users;
}).catch(err => ({ console.log(err) })

// OR WITH ASYNC/AWAIT
try {
  let user = await models.User.findAll({ where: { name: "Betty" } });
} catch (err) {

}
```

## Show

`.findByPk()` (if you have the id)

```js
models.User.findByPk(userId).then(user => {

}).catch(err => ({

})

// OR WITH ASYNC/AWAIT

try {
  let user = await models.User.findByPk(userId);
} catch (err) {

}
```

`findOne` (if you do not have the id)

```js
models.User.findOne({ where: { attribute: value } }).then(user => {

}).catch(err => ({

})

// OR WITH ASYNC/AWAIT

try {
  let user = await models.User.findByPk(userId);
} catch (err) {

}
```


## Create

`.create()`

```js
models.Task.create(req.body).then(task => {
  // you can now access the newly created task via the variable task
}).catch(err => ({

})

// OR USE ASYNC/AWAIT

let task = await models.Task.create(req.body);
```

Or if you prefer the railsy way — `.build()` then `.save()`

```js
models.Task.build(req.body).then(task => {
  task.save().then(task => {
  }).catch(err => ({

  });
  // you can now access the newly created task via the variable task
}).catch(err => ({

})

// OR WITH ASYNC/AWAIT

try {
  let user = await models.Task.build(req.body);
  user = await user.save();
} catch (err) {

}
```

## Update

`.update()`

```js
models.Task.findByPk(taskId).then(task => {
  task.update(req.body).then(task => {

  }).catch(err => ({

  })
}).catch(err => ({

})

// OR USE ASYNC/AWAIT

try {
  let task = await models.Task.findByPk(taskId);
  task = await task.update(req.body);
} catch (err) {

}
```

## Destroy

`.destroy()`

```js
Task.findByPk(taskId).then(task => {
  task.destroy()
}).catch(err => ({

})

// OR USE ASYNC/AWAIT

try {
  let task = await models.Task.findByPk(taskId);
  task.destroy();
} catch (err) {

}
```

## Find or Create

What if you want to look up a resource or create it? Well sequelize has you covered:

```js
let tag = models.Tag.findOrCreate(req.body)
```
