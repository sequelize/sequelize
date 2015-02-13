<a name="promise"></a>
# Class Promise
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L25)
A slightly modified version of bluebird promises. This means that, on top of the methods below, you can also call all the methods listed on the link below.

The main difference is that sequelize promises allows you to attach a listener that will be called with the generated SQL, each time a query is run.

The sequelize promise class works seamlessly with other A+/thenable libraries, with one exception.
If you want to propagate SQL events across `then`, `all` calls etc., you must use sequelize promises exclusively.

### Mixes:
* https://github.com/petkaantonov/bluebird/blob/master/API.md

***

<a name="on"></a>
## `on(evt, fct)`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L119)
Listen for events, event emitter style. Mostly for backwards compat. with EventEmitter

**Deprecated** 

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| evt | String |  |
| fct | Function |  |


***

<a name="emit"></a>
## `emit(type, value(s)*)`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L140)
Emit an event from the emitter
**Deprecated** 

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| type | string | The type of event |
| value(s)* | any | All other arguments will be passed to the event listeners  |


***

<a name="success"></a>
## `success(onSuccess)` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L178)
Listen for success events.

```js
promise.success(function (result) {
 //...
});
```

**Deprecated** 

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| onSuccess | function |  |

__Aliases:__ ok

***

<a name="error"></a>
## `error(onError)` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L205)
Listen for error events

```js
promise.error(function (err) {
 //...
});
```

**Deprecated** 

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| onError | function |  |

__Aliases:__ fail, failure

***

<a name="done"></a>
## `done(onDone)` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L228)
Listen for both success and error events.

```js
promise.done(function (err, result) {
 //...
});
```

**Deprecated** done(fct) is deprecated, done() is regular promise syntax to explicitly signal the end of a promise chain and will not be deprecated

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| onDone | function |  |

__Aliases:__ complete

***

<a name="sql"></a>
## `sql(onSQL)` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L253)
Attach a function that is called every time the function that created this emitter executes a query.

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| onSQL | function |  |


***

<a name="proxy"></a>
## `proxy(promise, [options])` -> `this`
[View code](https://github.com/sequelize/sequelize/blob/dbcbddd0f1bbdad7ff8b4f939616f51b610619a4/lib/promise.js#L268)
Proxy every event of this promise to another one.

**Deprecated** 

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| promise | SequelizePromise | The promise that should receive the events. |
| [options] | Object |  |
| [options.events] | Array | An array of the events to proxy. Defaults to sql, error and success |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_