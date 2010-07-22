var sys = require('sys');
var pack = require('./pack');
var constants = require('./constants');
var utils = require('./utils');
var types = require('./types');
var Charset = require('./charset').Charset;
var Promise = require('./node-promise').Promise;

// convert Numeric to LengthCodedBinary
var lcb = function(num) {
    if(num==undefined) return "\xfb";
    if(num<251) return pack.pack("C", num);
    if(num<65536) return pack.pack("Cv", 252, num);
    if(num<16777216) return pack.pack("CvC", 253, num&0xffff, num>>16);
    return pack.pack("CVV", 254, num&0xffffffff, num>>32);
}

/* convert LengthCodedBinary to Integer
# === Argument
# lcb :: [String] LengthCodedBinary. This value will be broken.
# === Return
# Integer or nil */
var lcb2int = function(lcbs) {
    if(!lcbs[0]) return undefined;
    
    var ret;
    var lcb = lcbs[0];
    var v = lcb.substring(0,1);
    lcb = lcb.slice(1);
    switch(v) {
    case "\xfb":
	v = undefined;
	break;
	
    case "\xfc":
	v = pack.unpack("v", lcb.substring(0,2))[0];
	lcb = lcb.slice(2);
	break;
	
    case "\xfd":
	v = pack.unpack("Cv", lcb.substring(0,3));
	lcb = lcb.slice(3);
	v = (v[1]<<8)+v[0];
	break;
	
    case "\xfe":
	v = pack.unpack("VV", lcb.substring(0,8));
	lcb = lcb.slice(8);
	v = (v[1]<<32)+v[0];
	break;
	
    default:
	v =  v.charCodeAt(0);
	break;
    }
    lcbs[0] = lcb;
    return(v);
}

var lcs = function(str) {
    return lcb(str.length)+str;
}

var lcs2str = function(lcs) {
    var len = lcb2int(lcs);
    if(typeof(len)=="undefined") return undefined;
    var data = lcs[0].substring(0, len);
    lcs[0] = lcs[0].slice(len);
    return data;
}
exports.lcs2str = lcs2str;

var net2value = function(adata, field, charset) {
    var unsigned = !!(field.flags & constants.field.UNSIGNED_FLAG);
    var binary = !!(field.flags & constants.field.BINARY_FLAG);
    var type = field.type;
    
    switch(type.id) {
    case constants.field.TYPE_BLOB:
    case constants.field.TYPE_STRING:
    case constants.field.TYPE_VAR_STRING:
    case constants.field.TYPE_NEWDECIMAL:
	if(binary) {
            return lcs2str(adata);
	}
	else {
            return charset.convertFromBytes(lcs2str(adata));
	}
    case constants.field.TYPE_TINY:
	var data = adata[0].substring(0, 1);
	adata[0] = adata[0].substring(1);
        var v = pack.unpack("C", data)[0]
        return unsigned ? v : v < (256)/2 ? v : v-(256);
	
    case constants.field.TYPE_SHORT:
	var data = adata[0].substring(0, 2);
	adata[0] = adata[0].substring(2);
        var v = pack.unpack("v", data)[0]
        return unsigned ? v : v < (65536)/2 ? v : v-(65536);
    
    case constants.field.TYPE_INT24:
    case constants.field.TYPE_LONG:
	var data = adata[0].substring(0, 4);
	adata[0] = adata[0].substring(4);
        var v = pack.unpack("V", data)[0]
        return unsigned ? v : v < (4294967296)/2 ? v : v-(4294967296);
    
    case constants.field.TYPE_LONGLONG:
	var data = adata[0].substring(0, 8);
	adata[0] = adata[0].substring(8);
        var n = pack.unpack("VV", data)
        var v = (n[1] << 32) | n[0];
        return unsigned ? v : v < (18446744073709551616)/2 ? v : v-(18446744073709551616);
    
    case constants.field.TYPE_FLOAT:
	var data = adata[0].substring(0, 4);
	adata[0] = adata[0].substring(4);
        return pack.unpack("e", data)[0]
    
    case constants.field.TYPE_DOUBLE:
	var data = adata[0].substring(0, 8);
	adata[0] = adata[0].substring(8);
        return pack.unpack("E", data)[0]
	
    case constants.field.TYPE_DATE:
    case constants.field.TYPE_DATETIME:
    case constants.field.TYPE_TIMESTAMP:
	var len = adata[0].charCodeAt(0);
	var data = adata[0].substring(1, len+1+1);
	adata[0] = adata[0].substring(len+1+1);
        var ret = pack.unpack("vCCCCCV", data);
	return new types.Time(ret[0], ret[1], ret[2], ret[3], ret[4], ret[5], ret[6]);
    
    case constants.field.TYPE_TIME:
	var len = adata[0].charCodeAt(0);
	var data = adata[0].substring(1, len+1+1);
	adata[0] = adata[0].substring(len+1+1);
        var ret = pack.unpack("CVCCCV", data);
	return new types.Time(0, 0, 0, ret[1]*24+ret[2], ret[3], ret[4], ret[0]!=0, ret[5]);
	
    case constants.field.TYPE_YEAR:
	var data = adata[0].substring(0, 2);
	adata[0] = adata[0].substring(2);
	return pack.unpack("v", data)[0];
    
    case constants.field.TYPE_BIT:
        return lcs2str(adata);

    default:
        throw "not implemented: type="+type;
    }
}

var value2net = function(v, charset) {
    var val = '', type=0;
    switch(typeof(v)) {
    case 'undefined':
        type = constants.field.TYPE_NULL;
        val = "";
	break;

    case 'number':
	if(parseInt(v)==v) { // is integer
            if(v >= 0) {
		if(v < 256) {
		    type = constants.field.TYPE_TINY | 0x8000;
		    val = pack.pack("C", v);
		}
		else if(v < 256*256) {
		    type = constants.field.TYPE_SHORT | 0x8000;
		    val = pack.pack("v", v);
		}
		else if(v < 256*256*256*256) {
		    type = constants.field.TYPE_LONG | 0x8000;
		    val = pack.pack("V", v);
		}
		else if(v < 256*256*256*256*256*256*256*256) {
		    type = constants.field.TYPE_LONGLONG | 0x8000
		    val = pack.pack("VV", v&0xffffffff, v>>32);
		}
		else {
		   throw "value too large: "+v;
		}
	    }
            else {
		if(-1*v <= 256/2) {
		    type = constants.field.TYPE_TINY;
		    val = pack.pack("C", v);
		}
		else if(-1*v <= (256*256)/2) {
		    type = constants.field.TYPE_SHORT;
		    val = pack.pack("v", v);
		}
		else if(-1*v <= (256*256*256*256)/2) {
		    type = constants.field.TYPE_LONG;
		    val = pack.pack("V", v);
		}
		else if(-1*v <= (256*256*256*256*256*256*256*256)/2) {
		    type = constants.field.TYPE_LONGLONG;
		    val = pack.pack("VV", v&0xffffffff, v>>32);
		}
		else {
		    throw "value too large: "+v;
		}
	    }
        }
	else { // is double
            type = constants.field.TYPE_DOUBLE;
            val = pack.pack("E", v);
	}
        break;
	
    case 'string':
        type = constants.field.TYPE_STRING;
        val = lcs(charset.convertToBytes(v));
	break;
	
    case 'object':
	if(v.constructor.toString().indexOf(" Date(")) {
            type = constants.field.TYPE_DATETIME;
	    val = pack.pack("CvCCCCC", 7, v.year, v.month, v.day, v.hour, v.minute, v.second);
	}
	else if(v.year || v.month || v.day || v.hour || v.minute || v.second) {
            type = constants.field.TYPE_DATETIME;
	    val = pack.pack("CvCCCCC", 7, v.year, v.month, v.day, v.hour, v.minute, v.second);
	}
	else {
	    throw "class: "+v+" is not supported";
	}
	break;
	
    default:
	throw "class: "+v+" is not supported";
    }
    return [type, val];
}


exports.InitialPacket = function(data) {
    res = pack.unpack("Ca*Va8CvCva13a13", data);
    
    this.protocol_version = res[0];     // C
    this.server_version = res[1];       // a*
    this.thread_id = res[2];            // V
    this.scramble_buff = res[3]+res[9]; // a8 + a13
    this.server_capabilities = res[5];  // v
    this.server_charset = res[6];       // C
    this.server_status = res[7];        // v
};

exports.AuthenticationPacket = function(client_flags, max_packet_size, charset_number, username, scrambled_password, databasename) {
    return(pack.pack("VVca23a*A*a*", 
        client_flags,
        max_packet_size,
        charset_number,
        "",                   // always 0x00 * 23
        username,
        lcs(scrambled_password),
        databasename || ''
    ));
};


// Field packet
var FieldPacket = function(db, table, org_table, name, org_name, charsetnr, length, type, flags, decimals, defaultVal) {
    this.db = db;
    this.table = table;
    this.org_table = org_table;
    this.name = name;
    this.org_name = org_name;
    this.charsetnr = charsetnr;
    this.length = length;
    this.type = types.Types[type];
    this.flags = flags;
    this.decimals = decimals;
    this.defaultVal = defaultVal;
}
exports.FieldPacket = FieldPacket;

FieldPacket.parse = function(data) {
    var adata = [data];

    var first = lcs2str(adata);
    var db = lcs2str(adata);
    var table = lcs2str(adata);
    var org_table = lcs2str(adata);
    var name = lcs2str(adata);
    var org_name = lcs2str(adata);

    var more = pack.unpack("CvVCvCva*", adata[0]);
    if(more[6]!=0) return undefined;
    // raise ProtocolError, "invalid packet: f1="+etc[0]+"" unless etc[0] == 0
    var defaultVal = lcs2str([more[7]]);
    return new FieldPacket(db, table, org_table, name, org_name, more[1], more[2], more[3], more[4], more[5], defaultVal);
}


var ResultPacket = function(field_count, affected_rows, insert_id, server_status, warning_count, message) {
    this.field_count = field_count;
    this.affected_rows = affected_rows;
    this.insert_id = insert_id;
    this.server_status = server_status;
    this.warning_count = warning_count;
    this.message = message;
}
exports.ResultPacket = ResultPacket;

ResultPacket.parse = function(data) {
    var adata = [data];
    var field_count = lcb2int(adata);
    
    if(field_count == 0) {
        var affected_rows = lcb2int(adata);
        var insert_id = lcb2int(adata);
	var ret = pack.unpack("vva*", adata[0]);
        var server_status = ret[0];
	var warning_count = ret[1];
	var message = lcs2str([ret[2]]);
	return(new ResultPacket(field_count, affected_rows, insert_id, server_status, warning_count, message));
    }
    else if(typeof(field_count)=='undefined') {
	return(new ResultPacket(undefined, undefined, undefined, undefined, undefined, adata[0]));
    }
    return(new ResultPacket(field_count))
}


var PrepareResultPacket = function(statement_id, field_count, param_count, warning_count) {
    this.statement_id = statement_id;
    this.field_count = field_count;
    this.param_count = param_count;
    this.warning_count = warning_count;
}
exports.PrepareResultPacket = PrepareResultPacket;

PrepareResultPacket.parse = function(data) {
    var res = pack.unpack("cVvvCv", data);
    if(res[0]!=0 || res[4]!=0) throw("invalid packet");
    return new PrepareResultPacket(res[1], res[2], res[3], res[5]);
}

var ExecutePacket = {}
exports.ExecutePacket = ExecutePacket;

ExecutePacket.serialize = function(statement_id, cursor_type, values, charset) {
    var nbm = null_bitmap(values);
    var netvalues = "";
    var types = values.map(function(v) {
        var ret = value2net(v, charset);
        if(typeof(v)!='undefined') {
	    netvalues = netvalues.concat(ret[1]);
	}
        return ret[0];
    });
    
    return pack.pack("CVCVZ*CZ*Z*", constants.com.STMT_EXECUTE, statement_id, cursor_type, 1, nbm, 1, pack.pack("v*", types), netvalues);
}

// make null bitmap
// If values is [1, nil, 2, 3, nil] then returns "\x12"(0b10010).
var null_bitmap = function(values) {  
    var val=0, len=0, bitmap=[];
    values.map(function(v) {
	val += (typeof(v)=="undefined" ? 1<<len : 0);
	len += 1;
	if(len==8) {
	    bitmap.push(val);
	    len = val = 0;
	}
	return val;
    });
    if(len>0) {
	bitmap.push(val);
    }
    return pack.pack("C*", bitmap);
}

// StatementRecord packet
var StatementRecordPacket = function(){
}
exports.StatementRecordPacket = StatementRecordPacket;

StatementRecordPacket.parse = function(data, fields, charset) {
    var null_bit_map_len = (fields.length+7+2)/8;
    var null_bit_map = pack.unpack("b*", data.substring(1, null_bit_map_len+1+1))[0];
    var i = -1, v;
    var adata = [data.substring(1+null_bit_map_len)];
    return fields.map(function(field) {
	i += 1;
        if(null_bit_map.substring(i+2,i+3) == '1') {
            return undefined;
        }
	else {
            return net2value(adata, field, charset);
	}
    });
}
