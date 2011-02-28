var net = require('net');
var sys = require('sys');

var SocketClient = require('./socketclient')

exports.createTCPClient = function(host, port)
{
    var host = host ? host : "localhost";
    var port = port ? port : 3306;
    var connection = net.createConnection(port, host);

    return new SocketClient(connection);
}

exports.createUNIXClient = function(path)
{
    var path = path ? path : "/var/run/mysqld/mysqld.sock";
    var connection = net.createConnection(path);
    
    return new SocketClient(connection);
}
    
function dump(d)
{
   return;
   for (var i=0; i < d.length; ++i)
   {
       sys.puts(i.toString() + " " + d.charAt(i) + " " + d.charCodeAt(i).toString());
   }
}