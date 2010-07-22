var sha1;
try {
    var crypto = require('crypto');
    sha1 = function(message) {
	return (new crypto.Hash).init("sha1").update(message).digest();
    }
}
catch(e) {
    var SHA1 = require('./sha1').SHA1;
    var i32tostr = function(i32) {
	var ret = '';
	for (var i=0; i<4; ++i) {
	    v = i32 & 0xff;
	    i32 >>>= 8;
	    ret = String.fromCharCode(v) + ret;
	}
	return ret;
    };
    
    sha1 = function(message) {
	var digest = new SHA1(message).digest();
	var ret = "";
	for(var i=0; i<digest.length; ++i) {
	    ret += i32tostr(digest[i]);
	}
	return ret;
    }
}

exports.encrypt_password = function(plain, scramble) {
    var stage1 = sha1(plain);
    var stage2 = sha1(scramble+sha1(stage1));
    var result = "";
    for(var i=0; i<stage1.length; ++i) {
	result += String.fromCharCode(stage1.charCodeAt(i) ^ stage2.charCodeAt(i));
    }
    return(result);
}

/*
node-mysql
A node.js interface for MySQL
http://github.com/masuidrive/node-mysql

Copyright (c) Yuichiro MASUI <masui@masuidrive.jp>
License: MIT License
*/
