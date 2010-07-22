// Result:
// Result set
var sys = require('sys');
var utils = require('./utils');

// Result set
var ResultBase = function(fields) {
    this.fields = fields;
    this.records = [];
    this.fieldname_with_table = false;
}
exports.ResultBase = ResultBase;


var Result = function(fields, protocol) {
    ResultBase.call(this, fields);
    this.protocol = protocol;
}
sys.inherits(Result, ResultBase);
exports.Result = Result;

Result.prototype.fetch_all = function() {
    var promise = this.protocol.retr_all_records(this.fields,
	utils.scope(this, function(rec) { // each
            this.records.push(rec);
	}),
	utils.scope(this, function() {    // result
	    return this;
	}));
    return promise;
}

Result.prototype.toHash = function(row) {
    var result, name, field;
    result = {};
    for(var i = 0; i<this.fields.length; ++i) {
	field = this.fields[i];
	name = ((this.fieldname_with_table && field.table) ? (field.table+".") : "") + field.name;
	result[name] = row[i];
    }
    return result;
}


var StatementResult = function(fields, protocol) {
    ResultBase.call(this, fields);
    this.protocol = protocol;
}
sys.inherits(StatementResult, ResultBase);
exports.StatementResult = Result;


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
