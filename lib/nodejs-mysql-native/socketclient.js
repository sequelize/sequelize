var sys = require('sys')
  , net = require('net')
  , reader = require('./serializers/reader')
  , writer = require('./serializers/writer')
  , commands = require('./commands')
  , queue = require('./containers/queue')
  
function packetLength(data)
{
    var len = data.charCodeAt(0);
    len += (data.charCodeAt(1) << 8);
    len += (data.charCodeAt(2) << 16);
    return len;
}

function SocketClient(connection) {
  
    var client = this;
    this.queued_cmds = new queue();
    this.connection = connection;
    
    this.connection.buffer = "";
    this.connection.pscache = {}
    this.connection.setEncoding("binary");
    this.connection.setTimeout(0);

    this.settings = {
      row_as_hash: true,
      auto_prepare: true
    }

    // expose api methods as client instance methods
    var apimethods = Object.getOwnPropertyNames(commands)
    apimethods.forEach(function(name, i, apimethods) {
      client[name] = function() {
        return this.add(commands[name].apply(client, arguments))
      }
    })

    this.connection.addListener("data", function(data) {
      // TODO: move to 'onconnect' event
      // replace connected with 'first packet' or 'ready state' or smth similar
      if (!this.connected)
      {
          this.connected = true;
          client.dispatch_packet();
      }
    
      this.buffer += data;
      var len = packetLength(this.buffer);

      while (this.buffer.length >= len + 4)
      {
          var packet = this.buffer.substr(4,len);
          client.dispatch_packet(new reader(packet) );
          this.buffer = this.buffer.substr(len+4, this.buffer.length-len-4);
          len = packetLength(this.buffer);
      }
    })

    return client;
}
 
SocketClient.prototype.set = function(name, val) {
  this.settings[name] = val
  return this
}

SocketClient.prototype.get = function(name) {
  return this.settings[name]
}
 
SocketClient.prototype.escape = function(str) {
  str = str.replace(/\0/g, "\\0")
  str = str.replace(/\n/g, "\\n")
  str = str.replace(/\r/g, "\\r")
  str = str.replace(/\032/g, "\\Z")
  str = str.replace(/([\'\"]+)/g, "\\$1")

  return str
}

SocketClient.prototype.quote = function(str) {
  return (typeof str === 'number') ? str : "'" + this.escape(str) + "'"
}

SocketClient.prototype.terminate = function() {
    this.connection.end();
}

SocketClient.prototype.write_packet = function(packet, pnum) {
    packet.addHeader(pnum);
    this.connection.write(packet.data, 'binary');
}

SocketClient.prototype.dispatch_packet = function(packet) {
    if (this.queued_cmds.empty())
        return;
    if (this.queued_cmds.top().process_packet(packet))
    {
        this.queued_cmds.shift();
        this.connection.emit('queue', this.queued_cmds.length);
        this.dispatch_packet();
    }
}

// proxy request to socket eventemitter
SocketClient.prototype.on = SocketClient.prototype.addListener = function() {
    this.connection.addListener.apply(this.connection, arguments);
}

SocketClient.prototype.add = function(c) {
    c.connection = this;
    var need_start_queue = this.connection.connected && this.queued_cmds.empty();
    this.queued_cmds.push(c);
    this.connection.emit('queue', this.queued_cmds.length); 
    if (need_start_queue)
        this.dispatch_packet();

    var connection = this.connection;
    //c.addListener('end', function(cmd) { connection.emit('command_end', c); });
    c.addListener('error', function(e) { 
//      sys.puts(e.message);
    });  // TODO: throw exception
    
    return c;
}

module.exports = SocketClient