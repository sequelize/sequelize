/*
node-mysql

node-mysql is pure Javascript MySQL network driver for [node.js](http://nodejs.org/)
*/
var sys = require('sys');
var events = require('events');
var result = require('./mysql/result');
var types = require('./mysql/types');
var utils = require('./mysql/utils');
var errors = require('./mysql/errors');
var Promise = require('./mysql/node-promise').Promise;
var Protocol = require('./mysql/protocol').Protocol;
var constants = require('./mysql/constants')
exports.constants = constants;

exports.Time = types.Time;
exports.quote = types.quote;
exports.constants = constants;


var Connection = function(hostname, username, password, dbname, port) {
    events.EventEmitter.call(this);
    this.protocol = undefined;
    this.active = false;
    this.connect_parameter = Array.prototype.slice.call(arguments);
    this.last_error = undefined;
    this.sqlstate = undefined;
    this._timeout = undefined;
    this.defaultErrback = function(error) {
	sys.puts("MySQL error: "+error);
    }
}
sys.inherits(Connection, events.EventEmitter);
exports.Connection = Connection;

Connection.prototype.connect = function(callback, errback) {
    this.protocol = new Protocol(this.connect_parameter[0], this.connect_parameter[4]);
    if(this._timeout) this.protocol.timeout(this._timeout);
    this.protocol.addListener('connect', utils.scope(this, function() {	
	this.active = false;
	this.emit('connect');
	this.protocol.authenticate(this.connect_parameter[1],
				   this.connect_parameter[2],
				   this.connect_parameter[3],
				   (this.local_infile ? constants.client.LOCAL_FILES : 0),
				   'utf8_general_ci'
				  )
	    .addCallback(callback)
	    .addErrback(errback || this.defaultErrback);
    }));
    this.protocol.addListener('close', utils.scope(this, function() {	
	this.active = false;
	this.emit('close');
    }));
    this.protocol.addListener('authorized', utils.scope(this, function() {	
	this.active = true;
	this.emit('authorized');
    }));
    this.protocol.addListener('authorize error', utils.scope(this, function() {
	this.active = false;
	this.emit('authorize error');
    }));
}

Connection.prototype.close = function() {
    this.protocol.close();
}

Connection.prototype.timeout = function(msec) {
    if(msec) {
	this._timeout = msec;
	if(this.protocol) this.protocol.timeout(this._timeout);
    }
    return this._timeout;
}

// Set autocommit mode
Connection.prototype.autocommit = function(flag, callback, errback) {
    this.query("set autocommit="+(flag ? "1" : "0"), callback, (errback || this.defaultErrback));
}

Connection.prototype.query = function(sql, callback, errback) {
    var sql = this.extract_placeholder(sql);
    if(sql.constructor==errors.ClientError.prototype.constructor) {
	(errback || this.defaultErrback)(sql);
	return;
    }
    this.protocol.query_command(sql)
	.addCallback(utils.scope(this, function(nfields) {
	    if(nfields) {
		this.protocol.retr_fields(nfields)
		    .addCallback(utils.scope(this, function(fields) {
			this.fields = fields;
			this.get_result()
			    .addCallback(utils.scope(this, function(rows) {
				this.server_status = this.protocol.server_status;
				try {
				    if(callback) callback(rows);
				}
				catch(error) {
				    (errback || this.defaultErrback)(error);
				}
			    }))
			    .addErrback(errback || this.defaultErrback);
		    }))
		    .addErrback(errback || this.defaultErrback);
	    }
	    else {
		var result = {};
		result.affected_rows = this.affected_rows = this.protocol.affected_rows;
		result.insert_id = this.insert_id = this.protocol.insert_id;
		result.server_status = this.server_status = this.protocol.server_status;
		result.warning_count = this.warning_count = this.protocol.warning_count;
		result.info = this.info = this.protocol.message;
		try {
		    if(callback) callback(result);
		}
		catch(error) {
		    (errback || this.defaultErrback)(error);
		}
	    }
	}))
	.addErrback(errback || this.defaultErrback);
}

Connection.prototype.extract_placeholder = function(sql) {
    if(typeof(sql)=='string') return sql;
    
    var format = sql[0];
    var bind = sql.slice(1).map(function(v) {
	return types.convertToSQLString(v);
    });
    if(format.match(/\?/g).length!=bind.length) {
	return new errors.ClientError('parameter count mismatch');
    }
    return format.replace(/\?/g, function() {
	return bind.shift();
    });
}

Connection.prototype.set_server_option = function(opt) {
    return this.protocol.set_option_command(opt);
}

Connection.prototype.get_result = function(fields) {
    var res = new result.Result(this.fields.map(function(field) {
	return(new Field(field));
    }), this.protocol);
    return res.fetch_all();
}

Connection.prototype.has_more_results = function() {
    return !!(this.protocol.server_status & constants.server.MORE_RESULTS_EXISTS);
}

Connection.prototype.next_result = function(callback, errback) {
    if(!this.has_more_results()) {
	process.nextTick(new Error("ClientError", "Don't have more results"));
	return;
    }
    this.protocol.get_result()
	.addCallback(utils.scope(this, function(nfields) {
	    this.protocol.retr_fields(nfields)
		.addCallback(utils.scope(this, function(fields) {
		    this.fields = fields;
		    this.result_exist = true;
		    this.get_result()
			.addCallback(utils.scope(this, function(results) {
			    try {
				if(callback) callback(results);
			    }
			    catch(error) {
				(errback || this.defaultErrback)(error);
			    }
			}))
			.addErrback(errback || this.defaultErrback);
		}))
		.addErrback(errback || this.defaultErrback);
	}))
	.addErrback(errback || this.defaultErrback);
}

Connection.prototype.prepare = function(str, callback, errback) {
    var stmt = new Stmt(this.protocol, this.charset);
    return stmt.prepare(str, callback, (errback || this.defaultErrback));
};


var Stmt = function(protocol, charset) {
    this.protocol = protocol;
    this.charset = charset;
    this.statement_id = undefined;
    this.affected_rows = this.insert_id = this.server_status = this.warning_count = 0;
    this.sqlstate = "00000";
    this.param_count = undefined;
}

Stmt.prototype.close = function() {
    this.protocol.stmt_close_command(this.statement_id);
    this.statement_id = undefined;
    this.param_count = undefined;
}

Stmt.prototype.prepare = function(query, callback, errback) {
    this.close();
    this.protocol.stmt_prepare_command(query)
        .addCallback(utils.scope(this, function(statement_id, param_count, field_packets) {
	    this.statement_id = statement_id;
            this.sqlstate = "00000";
	    this.param_count = param_count;
	    this.fields = field_packets.map(function(field_packet) {
		return new Field(field_packet);
	    });
	    try {
		if(callback) callback(this);
	    }
	    catch(error) {
		(errback || this.defaultErrback)(error);
	    }
        }))
        .addErrback(errback || this.defaultErrback);
}

Stmt.prototype.execute = function(args, callback, errback) {
    if(typeof(this.param_count)=='undefined') {
	errback(new errors.ClientError("not prepared"));
	return;
    }
    if(this.param_count!=args.length) {
	errback(new errors.ClientError("parameter count mismatch"));
	return;
    }
    this.sqlstate = "00000";
    this.protocol.stmt_execute_command(this.statement_id, args)
        .addCallback(utils.scope(this, function(nfields) {
            if(typeof(nfields)!='undefined') {
		this.protocol.retr_fields(nfields)
		    .addCallback(utils.scope(this, function(fields) {
			this.fields = fields;
			this.result = new result.StatementResult(this.fields, this.protocol);
			this.protocol.stmt_retr_all_records(fields, this.charset)
			    .addCallback(utils.scope(this, function(records) {
				this.result.records = records;
				try {
				    callback(this.result);
				}
				catch(error) {
				    (errback || this.defaultErrback)(error);
				}
			    }))
			    .addErrback(errback || this.defaultErrback);
		    }))
		    .addErrback(errback || this.defaultErrback);
	    }
	    else {
		this.affected_rows = this.protocol.affected_rows;
		this.insert_id = this.protocol.insert_id;
		this.server_status = this.protocol.server_status;
		this.warning_count = this.protocol.warning_count;
		this.info = this.protocol.message;
		try {
		    callback();
		}
		catch(error) {
		    (errback || this.defaultErrback)(error);
		}
	    }
	}))
	.addErrback(errback || this.defaultErrback);
}


var Field = function(packet) {
    this.db = packet.db;
    this.table = packet.table;
    this.org_table = packet.org_table;
    this.name = packet.name;
    this.org_name = packet.org_name;
    this.charsetnr = packet.charsetnr;
    this.length = packet.length;
    this.type = packet.type;
    this.flags = packet.flags;
    this.decimals = packet.decimals;
    this.defaultVal = packet.defaultVal;
}
exports.Field = Field;

Field.prototype.is_num = function() {
    return [constants.field.TYPE_DECIMAL, constants.field.TYPE_TINY, constants.field.TYPE_SHORT, constants.field.TYPE_LONG, constants.field.TYPE_FLOAT, constants.field.TYPE_DOUBLE, constants.field.TYPE_LONGLONG, constants.field.TYPE_INT24].indexOf(this.type.id) >= 0;
}

Field.prototype.is_not_null = function() {
    return !!(this.flags & constants.field.NOT_NULL_FLAG);
}

Field.prototype.is_pri_key = function() {
    return !!(this.flags & constants.field.PRI_KEY_FLAG);
}


/*
node-mysql
A node.js interface for MySQL

Author: masuidrive <masui@masuidrive.jp>
License: MIT License
Copyright (c) Yuichiro MASUI

# Original:
# http://github.com/tmtm/ruby-mysql
# Copyright (C) 2009-2010 TOMITA Masahiro
# mailto:tommy@tmtm.org
# License: Ruby's
*/
