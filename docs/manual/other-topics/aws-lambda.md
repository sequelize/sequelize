# Using sequelize in AWS Lambda

[AWS Lambda](https://aws.amazon.com/lambda/) is a serverless computing service that allows customers
to run code without having to worry about the underlying servers. Using `sequelize` in AWS Lambda
can be tricky if certain concepts are not properly understood and an appropriate configuration is
not used. This guide seeks to clarify some of these concepts so users of the library can properly
configure `sequelize` for AWS Lambda and troubleshoot issues.

## TL;DR

If you just want to learn how to properly configure `sequelize`
[connection pooling](./connection-pool.html) for AWS Lambda, all you need to know is that
`sequelize` connection pooling does not get along well with AWS Lambda's Node.js runtime and it ends
up causing more problems than it solves. Therefore, the most appropriate configuration is to **use
pooling within the same invocation** and **avoid pooling across invocations** (i.e. close all
connections at the end):

```js
const { Sequelize } = require("sequelize");

let sequelize = null;

async function loadSequelize() {
  const sequelize = new Sequelize(/* (...) */, {
    // (...)
    pool: {
      /*
       * Lambda functions process one request at a time but your code may issue multiple queries
       * concurrently. Be wary that `sequelize` has methods that issue 2 queries concurrently
       * (e.g. `Model.findAndCountAll()`). Using a value higher than 1 allows concurrent queries to
       * be executed in parallel rather than serialized. Careful with executing too many queries in
       * parallel per Lambda function execution since that can bring down your database with an
       * excessive number of connections.
       *
       * Ideally you want to choose a `max` number where this holds true:
       * max * EXPECTED_MAX_CONCURRENT_LAMBDA_INVOCATIONS < MAX_ALLOWED_DATABASE_CONNECTIONS * 0.8
       */
      max: 2,
      /*
       * Set this value to 0 so connection pool eviction logic eventually cleans up all connections
       * in the event of a Lambda function timeout.
       */
      min: 0,
      /*
       * Set this value to 0 so connections are eligible for cleanup immediately after they're
       * returned to the pool.
       */
      idle: 0,
      // Choose a small enough value that fails fast if a connection takes too long to be established.
      acquire: 3000,
      /*
       * Ensures the connection pool attempts to be cleaned up automatically on the next Lambda
       * function invocation, if the previous invocation timed out.
       */
      evict: CURRENT_LAMBDA_FUNCTION_TIMEOUT
    }
  });

  // or `sequelize.sync()`
  await sequelize.authenticate();

  return sequelize;
}

module.exports.handler = async function (event, callback) {
  // re-use the sequelize instance across invocations to improve performance
  if (!sequelize) {
    sequelize = await loadSequelize();
  } else {
    // restart connection pool to ensure connections are not re-used across invocations
    sequelize.connectionManager.initPools();

    // restore `getConnection()` if it has been overwritten by `close()`
    if (sequelize.connectionManager.hasOwnProperty("getConnection")) {
      delete sequelize.connectionManager.getConnection;
    }
  }

  try {
    return await doSomethingWithSequelize(sequelize);
  } finally {
    // close any opened connections during the invocation
    // this will wait for any in-progress queries to finish before closing the connections
    await sequelize.connectionManager.close();
  }
};
```

### Using AWS RDS Proxy

If your are using [AWS RDS](https://aws.amazon.com/rds/) and you are using
[Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html) or a
[supported database engine](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html),
then connect to your database using [AWS RDS Proxy](https://aws.amazon.com/rds/proxy/). This will
make sure that opening/closing connections on each invocation is not an expensive operation for
your underlying database server.

---

If you want to understand why you must use sequelize this way in AWS Lambda, continue reading the
rest of this document:

## The Node.js event loop

The [Node.js event loop](https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/) is:

> what allows Node.js to perform non-blocking I/O operations — despite the fact that JavaScript is
> single-threaded —

While the event loop implementation is in C++, here's a simplified JavaScript pseudo-implementation
that illustrates how Node.js would execute a script named `index.js`:

```js
// see: https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick/
// see: https://www.youtube.com/watch?v=P9csgxBgaZ8
// see: https://www.youtube.com/watch?v=PNa9OMajw9w
const process = require('process');

/*
 * counter of pending events
 *
 * reference counter is increased for every:
 *
 * 1. scheduled timer: `setTimeout()`, `setInterval()`, etc.
 * 2. scheduled immediate: `setImmediate()`.
 * 3. syscall of non-blocking IO: `require('net').Server.listen()`, etc.
 * 4. scheduled task to the thread pool: `require('fs').WriteStream.write()`, etc.
 *
 * reference counter is decreased for every:
 *
 * 1. elapsed timer
 * 2. executed immediate
 * 3. completed non-blocking IO
 * 4. completed thread pool task
 *
 * references can be explicitly decreased by invoking `.unref()` on some
 * objects like: `require('net').Socket.unref()`
 */
let refs = 0;

/*
 * a heap of timers, sorted by next ocurrence
 *
 * whenever `setTimeout()` or `setInterval()` is invoked, a timer gets added here
 */
const timersHeap = /* (...) */;

/*
 * a FIFO queue of immediates
 *
 * whenever `setImmediate()` is invoked, it gets added here
 */
const immediates = /* (...) */;

/*
 * a FIFO queue of next tick callbacks
 *
 * whenever `require('process').nextTick()` is invoked, the callback gets added here
 */
const nextTickCallbacks = [];

/*
 * a heap of Promise-related callbacks, sorted by promise constructors callbacks first,
 * and then resolved/rejected callbacks
 *
 * whenever a new Promise instance is created via `new Promise` or a promise resolves/rejects
 * the appropriate callback (if any) gets added here
 */
const promiseCallbacksHeap = /* ... */;

function execTicksAndPromises() {
  while (nextTickCallbacks.length || promiseCallbacksHeap.size()) {
    // execute all callbacks scheduled with `process.nextTick()`
    while (nextTickCallbacks.length) {
      const callback = nextTickCallbacks.shift();
      callback();
    }

    // execute all promise-related callbacks
    while (promiseCallbacksHeap.size()) {
      const callback = promiseCallbacksHeap.pop();
      callback();
    }
  }
}

try {
  // execute index.js
  require('./index');
  execTicksAndPromises();

  do {
    // timers phase: executes all elapsed timers
    getElapsedTimerCallbacks(timersHeap).forEach(callback => {
      callback();
      execTicksAndPromises();
    });

    // pending callbacks phase: executes some system operations (like `TCP errors`) that are not
    //                          executed in the poll phase
    getPendingCallbacks().forEach(callback => {
      callback();
      execTicksAndPromises();
    })

    // poll phase: gets completed non-blocking I/O events or thread pool tasks and invokes the
    //             corresponding callbacks; if there are none and there's no pending immediates,
    //             it blocks waiting for events/completed tasks for a maximum of `maxWait`
    const maxWait = computeWhenNextTimerElapses(timersHeap);
    pollForEventsFromKernelOrThreadPool(maxWait, immediates).forEach(callback => {
      callback();
      execTicksAndPromises();
    });

    // check phase: execute available immediates; if an immediate callback invokes `setImmediate()`
    //              it will be invoked on the next event loop iteration
    getImmediateCallbacks(immediates).forEach(callback => {
      callback();
      execTicksAndPromises();
    });

    // close callbacks phase: execute special `.on('close')` callbacks
    getCloseCallbacks().forEach(callback => {
      callback();
      execTicksAndPromises();
    });

    if (refs === 0) {
      // listeners of this event may execute code that increments `refs`
      process.emit('beforeExit');
    }
  } while (refs > 0);
} catch (err) {
  if (!process.listenerCount('uncaughtException')) {
    // default behavior: print stack and exit with status code 1
    console.error(err.stack);
    process.exit(1);
  } else {
    // there are listeners: emit the event and exit using `process.exitCode || 0`
    process.emit('uncaughtException');
    process.exit();
  }
}
```

## AWS Lambda function handler types in Node.js

AWS Lambda handlers come in two flavors in Node.js:

[Non-async handlers](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html#nodejs-handler-sync)
(i.e. `callback`):

```js
module.exports.handler = function (event, context, callback) {
  try {
    doSomething();
    callback(null, "Hello World!"); // Lambda returns "Hello World!"
  } catch (err) {
    // try/catch is not required, uncaught exceptions invoke `callback(err)` implicitly
    callback(err); // Lambda fails with `err`
  }
};
```

[Async handlers](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html#nodejs-handler-async)
(i.e. use `async`/`await` or `Promise`s):

```js
// async/await
module.exports.handler = async function (event, context) {
  try {
    await doSomethingAsync();
    return "Hello World!"; // equivalent of: callback(null, "Hello World!");
  } catch (err) {
    // try/cath is not required, async functions always return a Promise
    throw err; // equivalent of: callback(err);
  }
};

// Promise
module.exports.handler = function (event, context) {
  /*
   * must return a `Promise` to be considered an async handler
   *
   * an uncaught exception that prevents a `Promise` to be returned
   * by the handler will "downgrade" the handler to non-async
   */
  return Promise.resolve()
    .then(() => doSomethingAsync())
    .then(() => "Hello World!");
};
```

While at first glance it seems like async VS non-async handlers are simply a code styling choice,
there is a fundamental difference between the two:

- In async handlers, a Lambda function execution finishes when the `Promise` returned by the handler
  resolves or rejects, regardless of whether the event loop is empty or not.
- In non-async handlers, a Lambda function execution finishes when one of the following conditions
  occur:
  - The event loop is empty
    ([process `'beforeExit'` event](https://nodejs.org/dist/latest-v12.x/docs/api/process.html#process_event_beforeexit)
    is used to detect this).
  - The `callback` argument is invoked and
    [`context.callbackWaitsForEmptyEventLoop`](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html)
    is set to `false`.

This fundamental difference is very important to understand in order to rationalize how `sequelize`
may be affected by it. Here are a few examples to illustrate the difference:

```js
// no callback invoked
module.exports.handler = function () {
  // Lambda finishes AFTER `doSomething()` is invoked
  setTimeout(() => doSomething(), 1000);
};

// callback invoked
module.exports.handler = function (event, context, callback) {
  // Lambda finishes AFTER `doSomething()` is invoked
  setTimeout(() => doSomething(), 1000);
  callback(null, "Hello World!");
};

// callback invoked, context.callbackWaitsForEmptyEventLoop = false
module.exports.handler = function (event, context, callback) {
  // Lambda finishes BEFORE `doSomething()` is invoked
  context.callbackWaitsForEmptyEventLoop = false;
  setTimeout(() => doSomething(), 2000);
  setTimeout(() => callback(null, "Hello World!"), 1000);
};

// async/await
module.exports.handler = async function () {
  // Lambda finishes BEFORE `doSomething()` is invoked
  setTimeout(() => doSomething(), 1000);
  return "Hello World!";
};

// Promise
module.exports.handler = function () {
  // Lambda finishes BEFORE `doSomething()` is invoked
  setTimeout(() => doSomething(), 1000);
  return Promise.resolve("Hello World!");
};
```

## AWS Lambda execution environments (i.e. containers)

AWS Lambda function handlers are invoked by built-in or custom
[runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) which run in
execution environments (i.e. containers) that
[may or may not be re-used](https://aws.amazon.com/blogs/compute/container-reuse-in-lambda/)
across invocations. Containers can only process
[one request at a time](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).
Concurrent invocations of a Lambda function means that a container instance will be created for each
concurrent request.

In practice, this means that Lambda functions should be designed to be stateless but developers can
use state for caching purposes:

```js
let sequelize = null;

module.exports.handler = async function () {
  /*
   * sequelize will already be loaded if the container is re-used
   *
   * containers are never re-used when a Lambda function's code change
   *
   * while the time elapsed between Lambda invocations is used as a factor to determine whether
   * a container is re-used, no assumptions should be made of when a container is actually re-used
   *
   * AWS does not publicly document the rules of container re-use "by design" since containers
   * can be recycled in response to internal AWS Lambda events (e.g. a Lambda function container
   * may be recycled even if the function is constanly invoked)
   */
  if (!sequelize) {
    sequelize = await loadSequelize();
  }

  return await doSomethingWithSequelize(sequelize);
};
```

When a Lambda function doesn't wait for the event loop to be empty and a container is re-used,
the event loop will be "paused" until the next invocation occurs. For example:

```js
let counter = 0;

module.exports.handler = function (event, context, callback) {
  /*
   * The first invocation (i.e. container initialized) will:
   * - log:
   *   - Fast timeout invoked. Request id: 00000000-0000-0000-0000-000000000000 | Elapsed ms: 5XX
   * - return: 1
   *
   * Wait 3 seconds and invoke the Lambda again. The invocation (i.e. container re-used) will:
   * - log:
   *   - Slow timeout invoked. Request id: 00000000-0000-0000-0000-000000000000 | Elapsed ms: 3XXX
   *   - Fast timeout invoked. Request id: 11111111-1111-1111-1111-111111111111 | Elapsed ms: 5XX
   * - return: 3
   */
  const now = Date.now();

  context.callbackWaitsForEmptyEventLoop = false;

  setTimeout(() => {
    console.log(
      "Slow timeout invoked. Request id:",
      context.awsRequestId,
      "| Elapsed ms:",
      Date.now() - now
    );
    counter++;
  }, 1000);

  setTimeout(() => {
    console.log(
      "Fast timeout invoked. Request id:",
      context.awsRequestId,
      "| Elapsed ms:",
      Date.now() - now
    );
    counter++;
    callback(null, counter);
  }, 500);
};
```

## Sequelize connection pooling in AWS Lambda

`sequelize` uses connection pooling for optimizing usage of database connections. The connection
pool used by `sequelize` is implemented using `setTimeout()` callbacks (which are processed by the
Node.js event loop).

Given the fact that AWS Lambda containers process one request at a time, one would be tempted to
configure `sequelize` as follows:

```js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(/* (...) */, {
  // (...)
  pool: { min: 1, max: 1 }
});
```

This configuration prevents Lambda containers from overwhelming the database server with an
excessive number of connections (since each container takes at most 1 connection). It also makes
sure that the container's connection is not garbage collected when idle so the connection does not
need to be re-established when the Lambda container is re-used. Unfortunately, this configuration
presents a set of issues:

1. Lambdas that wait for the event loop to be empty will always time out. `sequelize` connection
   pools schedule a `setTimeout` every
   [`options.pool.evict`](../class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor)
   ms until **all idle connections have been closed**. However, since `min` is set to `1`, there
   will always be at least one idle connection in the pool, resulting in an infinite event loop.
1. Some operations like
   [`Model.findAndCountAll()`](../class/lib/model.js~Model.html#static-method-findAndCountAll)
   execute multiple queries asynchronously (e.g.
   [`Model.count()`](..class/lib/model.js~Model.html#static-method-count) and
   [`Model.findAll()`](../class/lib/model.js~Model.html#static-method-findAll)). Using a maximum of
   one connection forces the queries to be exectued serially (rather than in parallel using two
   connections). While this may be an acceptable performance compromise in order to
   maintain a manageable number of database connections, long running queries may result in
   [`ConnectionAcquireTimeoutError`](../class/lib/errors/connection/connection-acquire-timeout-error.js~ConnectionAcquireTimeoutError.html)
   if a query takes more than the default or configured
   [`options.pool.acquire`](../class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor)
   timeout to complete. This is because the serialized query will be stuck waiting on the pool until
   the connection used by the other query is released.
1. If the AWS Lambda function times out (i.e. the configured AWS Lambda timeout is exceeded), the
   Node.js event loop will be "paused" regardless of its state. This can cause race conditions that
   result in connection errors. For example, you may encounter situations where a very expensive
   query causes a Lambda function to time out, the event loop is "paused" before the expensive query
   finishes and the connection is released back to the pool, and subsequent Lambda invocations fail
   with a `ConnectionAcquireTimeoutError` if the container is re-used and the connection has not
   been returned after `options.pool.acquire` ms.

You can attempt to mitigate issue **#2** by using `{ min: 1, max: 2 }`. However, this will still
suffer from issues **#1** and **#3** whilst introducing additional ones:

1. Race conditions may occur where the even loop "pauses" before a connection pool eviction callback
   executes or more than `options.pool.evict` time elapses between Lambda invocations. This can
   result in timeout errors, handshake errors, and other connection-related errors.
1. If you use an operation like `Model.findAndCountAll()` and either the underlying `Model.count()`
   or `Model.findAll()` queries fail, you won't be able to ensure that the other query has finished
   executing (and the connection is put back into the pool) before the Lambda function execution
   finishes and the event loop is "paused". This can leave connections in a stale state which can
   result in prematurely closed TCP connections and other connection-related errors.

Using `{ min: 2, max: 2 }` mitigates additional issue **#1**. However, the configuration still
suffers from all the other issues (original **#1**, **#3**, and additional **#2**).

### Detailed race condition example

In order to make sense of the example, you'll need a bit more context of how certain parts of
Lambda and `sequelize` are implemented.

The built-in AWS Lambda runtime for `nodejs.12x` is implemented in Node.js. You can access the
entire source code of the runtime by reading the contents of `/var/runtime/` inside a Node.js Lambda
function. The relevant subset of the code is as follows:

**runtime/Runtime.js**

```js
class Runtime {
  // (...)

  // each iteration is executed in the event loop `check` phase
  scheduleIteration() {
    setImmediate(() => this.handleOnce().then(/* (...) */));
  }

  async handleOnce() {
    // get next invocation. see: https://docs.aws.amazon.com/lambda/latest/dg/runtimes-api.html#runtimes-api-next
    let { bodyJson, headers } = await this.client.nextInvocation();

    // prepare `context` handler parameter
    let invokeContext = new InvokeContext(headers);
    invokeContext.updateLoggingContext();

    // prepare `callback` handler parameter
    let [callback, callbackContext] = CallbackContext.build(
      this.client,
      invokeContext.invokeId,
      this.scheduleIteration.bind(this)
    );

    try {
      // this listener is subscribed to process.on('beforeExit')
      // so that when when `context.callbackWaitsForEmptyEventLoop === true`
      // the Lambda execution finishes after the event loop is empty
      this._setDefaultExitListener(invokeContext.invokeId);

      // execute handler
      const result = this.handler(
        JSON.parse(bodyJson),
        invokeContext.attachEnvironmentData(callbackContext),
        callback
      );

      // finish the execution if the handler is async
      if (_isPromise(result)) {
        result
          .then(callbackContext.succeed, callbackContext.fail)
          .catch(callbackContext.fail);
      }
    } catch (err) {
      callback(err);
    }
  }
}
```

The runtime schedules an iteration at the end of the initialization code:

**runtime/index.js**

```js
// (...)

new Runtime(client, handler, errorCallbacks).scheduleIteration();
```

All SQL queries invoked by a Lambda handler using `sequelize` are ultimately executed using
[Sequelize.prototype.query()](../class/lib/sequelize.js~Sequelize.html#instance-method-query).
This method is responsible for obtaining a connection from the pool, executing the query, and
releasing the connection back to the pool when the query completes. The following snippet shows
a simplification of the method's logic for queries without transactions:

**sequelize.js**

```js
class Sequelize {
  // (...)

  query(sql, options) {
    // (...)

    const connection = await this.connectionManager.getConnection(options);
    const query = new this.dialect.Query(connection, this, options);

    try {
      return await query.run(sql, bindParameters);
    } finally {
      await this.connectionManager.releaseConnection(connection);
    }
  }
}
```

The field `this.connectionManager` is an instance of a dialect-specific `ConnectionManager` class.
All dialect-specific managers inherit from an abstract `ConnectionManager` class which initializes
the connection pool and configures it to invoke the dialect-specific class' `connect()` method
everytime a new connection needs to be created. The following snippet shows a simplification of the
`mysql` dialect `connect()` method:

**mysql/connection-manager.js**

```js
class ConnectionManager {
  // (...)

  async connect(config) {
    // (...)
    return await new Promise((resolve, reject) => {
      // uses mysql2's `new Connection()`
      const connection = this.lib.createConnection(connectionConfig);

      const errorHandler = (e) => {
        connection.removeListener("connect", connectHandler);
        connection.removeListener("error", connectHandler);
        reject(e);
      };

      const connectHandler = () => {
        connection.removeListener("error", errorHandler);
        resolve(connection);
      };

      connection.on("error", errorHandler);
      connection.once("connect", connectHandler);
    });
  }
}
```

The field `this.lib` refers to [`mysql2`](https://www.npmjs.com/package/mysql2) and the function
`createConnection()` creates a connection by creating an instance of a `Connection` class. The
relevant subset of this class is as follows:

**mysql2/connection.js**

```js
class Connection extends EventEmitter {
  constructor(opts) {
    // (...)

    // create Socket
    this.stream = /* (...) */;

    // when data is received, clear timeout
    this.stream.on('data', data => {
      if (this.connectTimeout) {
        Timers.clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }
      this.packetParser.execute(data);
    });

    // (...)

    // when handshake is completed, emit the 'connect' event
    handshakeCommand.on('end', () => {
      this.emit('connect', handshakeCommand.handshake);
    });

    // set a timeout to trigger if no data is received on the socket
    if (this.config.connectTimeout) {
      const timeoutHandler = this._handleTimeoutError.bind(this);
      this.connectTimeout = Timers.setTimeout(
        timeoutHandler,
        this.config.connectTimeout
      );
    }
  }

  // (...)

  _handleTimeoutError() {
    if (this.connectTimeout) {
      Timers.clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
    this.stream.destroy && this.stream.destroy();
    const err = new Error('connect ETIMEDOUT');
    err.errorno = 'ETIMEDOUT';
    err.code = 'ETIMEDOUT';
    err.syscall = 'connect';

    // this will emit the 'error' event
    this._handleNetworkError(err);
  }
}
```

Based on the previous code, the following sequence of events shows how a connection pooling
race condition with `{ min: 1, max: 1 }` can result with in a `ETIMEDOUT` error:

1. A Lambda invocation is received (new container):
   1. The event loop enters the `check` phase and `runtime/Runtime.js`'s `handleOnce()` method is
      invoked.
      1. The `handleOnce()` method invokes `await this.client.nextInvocation()` and waits.
   1. The event loop skips the `timers` phase since there no pending timers.
   1. The event loop enters the `poll` phase and the `handleOnce()` method continues.
   1. The Lambda handler is invoked.
   1. The Lambda handler invokes `Model.count()` which invokes `sequelize.js`'s `query()` which
      invokes `connectionManager.getConnection()`.
   1. The connection pool initializes a `setTimeout(..., config.pool.acquire)` for `Model.count()`
      and invokes `mysql/connection-manager.js`'s `connect()` to create a new connection.
   1. `mysql2/connection.js` creates the TCP socket and initializes a `setTimeout()` for failing
      the connection with `ETIMEDOUT`.
   1. The promise returned by the handler rejects (for reasons not detailed here) so the Lambda
      function execution finishes and the Node.js event loop is "paused".
1. Enough time elapses beween invocations so that:
   1. `config.pool.acquire` timer elapses.
   1. `mysql2` connection timer has not elapsed yet but has almost elapsed (i.e. race condition).
1. A second Lambda invocation is received (container re-used):
   1. The event loop is "resumed".
   1. The event loop enters the `check` phase and `runtime/Runtime.js`'s `handleOnce()` method is
      invoked.
   1. The event loop enters the `timers` phase and the `config.pool.acquire` timer elapses, causing
      the previous invocation's `Model.count()` promise to reject with
      `ConnectionAcquireTimeoutError`.
   1. The event loop enters the `poll` phase and the `handleOnce()` method continues.
   1. The Lambda handler is invoked.
   1. The Lambda handler invokes `Model.count()` which invokes `sequelize.js`'s `query()` which
      invokes `connectionManager.getConnection()`.
   1. The connection pool initializes a `setTimeout(..., config.pool.acquire)` for `Model.count()`
      and since `{ max : 1 }` it waits for the pending `connect()` promise to complete.
   1. The event loop skips the `check` phase since there are no pending immediates.
   1. **Race condition:** The event loop enters the `timers` phase and the `mysql2` connection
      timeout elapses, resulting in a `ETIMEDOUT` error that is emitted using
      `connection.emit('error')`.
   1. The emitted event rejects the promise in `mysql/connection-manager.js`'s `connect()` which
      in turn forwards the rejected promise to the `Model.count()` query's promise.
   1. The lambda function fails with an `ETIMEDOUT` error.
