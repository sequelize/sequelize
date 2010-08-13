var queue = require('./containers').queue;
var sys= require('sys');

function pool(newConnectionFactory, minConnections)
{
   this.newConnectionFactory = newConnectionFactory;

   // some reasonable defaults
   if (minConnections)
       this.minConnections = minConnections; // lazy by default 
   else
       this.minConnections = 0;
   this.maxConnections = 16;
   this.maxQueue = 2; // increase if average command time is much shorter compared to connect time
                      // TODO: calculate ratio on the fly? think of adaptiveMaxQueue
   this.idleTimeout = 0; // TODO: also possible to make adaptive
   this.maxWaiters = 100000000; // TODO: infinity?

   this.waiters = new queue();
   this.connections = new queue();
   for (var i=0; i <= this.minConnections; ++i)
      this.spawnConnection();
}

pool.prototype.spawnConnection = function()
{
    var client = this.newConnectionFactory();
    var self = this;
    // todo: Qt-style connection-slot api?
    client.connection.addListener('queue', function(new_size) { self.queueChanged(client, new_size); });
    var node = this.connections.push(client);
    client.pool_node = node;
    return client;
}

pool.prototype.queueChanged = function(client, new_size)
{
    if (new_size != 0)
        return;


    sys.puts('queue event ' + new_size);
    //var new_size = client.commands.length;

    // if (new_size == 1)
    //    sys.p(client.commands.begin.data);
    // sys.puts("New queue:" + new_size);

    if (!this.waiters.empty() && new_size == 0) //<= this.maxQueue)
    {
        var w = this.waiters.shift();
        sys.puts("free connection released to waiter" );
        if (w)
            w(client);
    }

    // there is no commands left for current connection
    // close it after idleTimeout
    if (new_size == 0 && this.connections.length > this.minConnections)
    {
        if (this.idleTimeout > 0)
        {
            //todo: add close timer
        } else {
            client.close();
        }
    }

    // calculate new index
}

pool.prototype.get = function(onClientReady)
{
    sys.puts("=== pool::get === ");
    // select client with minimal queue
    // if its queue length <= maxQueue, return it
    // if connections size less than maxConnection, spawn a new connection
    // else enqueue request
    // throw error if waiters queue length > maxWaiters


    // quick hack
    // TODO: add search using index
    var minQueueConnection = null;
    var minQueue = 1000000000;
    for (var i = this.connections.begin; i != this.connections.end; i = i.next)
    {
        var cli = i.data;
        var len = cli.commands.length;
        sys.puts("client q:" + len);
        if (len < minQueue)
        {
            minQueue = len;
            minQueueConnection = cli;
        }
    }
    sys.puts("min pool queue is " + minQueue);
    if (minQueue <= this.maxQueue)
    {
        sys.puts("using existing connection");
        return onClientReady(minQueueConnection);
    }
    if (this.connections.length < this.maxConnections)
    {
        sys.puts("sapwning new connection");
        return onClientReady(this.spawnConnection());
    }
    if (this.waiters.length < this.maxWaiters)
    {
        sys.puts("waiting for awailable connection");
        this.waiters.push(onClientReady);
        return;
    }
}
/*
pool.prototype.close = function()
{
    for (var i = this.connections.begin; i != this.connections.end; i = i.next)
    {
        i.data.close();
    }
}
*/

exports.pool = pool;
