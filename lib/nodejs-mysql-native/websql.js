// wrappers to provide WebSql-alike interface to mysql

var createTCPClient = require('./client').createTCPClient;
var sys = require('sys');

function transaction(connection)
{
    this.connection = connection;
}

transaction.prototype.executeSql = function (query, args, rsCallback, errorCallback)
{
    var tx = this;
    if (!tx.clean)
    {
        sys.puts("skipped due to errors");
        return;
    }
    var execCmd = this.connection.execute(query, args);
    var results = {};
    results.rows = [];
    this.connection.row_as_hash = true;
    execCmd.addListener('row', function(r) {
        results.rows.push(r);
    });
    execCmd.addListener('end', function() { if (tx.clean && rsCallback) rsCallback(tx, results); });
    execCmd.addListener('error', function(err)
    { 
       tx.clean = false; 
       if (errorCallback) 
          errorCallback(tx, err);
       if (tx.onerror)
           tx.onerror(err); 
    });
    tx.last_exec_cmd = execCmd;
}

exports.openDatabase = function(db, user, password)
{
    var webdb = {};
    var connection = createTCPClient();
    connection.auth(db, user, password);
    connection.query('SET autocommit=0;');
    connection.auto_prepare = true;
    webdb.transaction = function(txCreated, txError)
    {
        var t = new transaction(connection);
        t.onerror = txError;
        connection.query('BEGIN');
        t.clean = true;
        txCreated(t);
        var commit = connection.query("");
        t.last_exec_cmd.addListener('end', function()
        {   
            commit.sql = t.clean ? "COMMIT" : "ROLLBACK"
       });
    }
    webdb.close = function() { connection.close(); };
    return webdb;
}
