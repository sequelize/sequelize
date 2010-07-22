// 
// Append read() to tcp.Connection
//  
var sys = require('sys');
var tcp = require("net");
var events = require("events");
var errors = require('./errors');
var utils = require('./utils');
var Promise = require('./node-promise').Promise;

var Socket = function(connect_callback, close_callback) {
    this.conn = undefined;
    this._timeout = 0;
    this.buffer = '';
    this.read_queue = [];
    this.connect_callback = connect_callback;
    this.close_callback = close_callback;
}
sys.inherits(Socket, events.EventEmitter);
exports.Socket = Socket;

Socket.prototype.timeout = function(timeout) {
    this._timeout = timeout;
}

Socket.prototype.connect = function(port, host) {
    if(this.conn) {
	throw "Already open";
    }
    else {
	this.conn = tcp.createConnection(port, host);
	this.conn.addListener("data", utils.scope(this, function(data) {
	    this.buffer += data;
	    this.process_tcp_read_queue();
	}));
	this.conn.addListener("connect", utils.scope(this, function(){
	    this.conn.setEncoding("binary");
	    this.conn.setNoDelay(true);
	    this.conn.setTimeout(this._timeout);
	    this.connect_callback();
	}));
	this.conn.addListener("close", utils.scope(this, function(hasError) {
	    var task;
	    while(task=this.read_queue.shift()) {
		task.promise.emitError(new errors.ClientError('connection was closed'));
	    }
	    this.conn = undefined;
	    this.close_callback(hasError);
	}));
    }
}

Socket.prototype.readyState = function() {
    return this.conn.readyState;
}

Socket.prototype.close = function() {
    if(this.conn) this.conn.end();
}

Socket.prototype.read = function(len) {
    var promise = new Promise();
    if(this._timeout) promise.timeout(this._timeout, function(){ return new errors.ClientError('connection timeout'); });
    this.read_queue.push({len: len, promise: promise});
    if(this.buffer) this.process_tcp_read_queue();
    return promise;
}

Socket.prototype.process_tcp_read_queue = function() {
    if(this.read_queue.length==0) return;
    var task, data;
    if(typeof(this.read_queue[0].len)=='undefined') {
	task = this.read_queue.shift();
	data = this.buffer;
	this.buffer = '';
	task.promise.emitSuccess(data);
    }
    else if(this.buffer.length>=this.read_queue[0].len) {
	task = this.read_queue.shift();
	data = this.buffer.substring(0, task.len);
	this.buffer = this.buffer.slice(task.len);
	task.promise.emitSuccess(data);
	this.process_tcp_read_queue();
    }
}

Socket.prototype.write = function(data) {
    this.conn.write(data, 'binary');
}


/*
node-mysql
A node.js interface for MySQL

Author: masuidrive <masui@masuidrive.jp>
License: MIT License
Copyright (c) Yuichiro MASUI
*/
