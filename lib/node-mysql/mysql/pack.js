// 
// pack/unpack style seralizer and deserializer.
//  
exports.unpack = function(format, data) {
    var result = [];
    var instruction, quantifier, currentData, i, j, k;
    
    while(format) {
	instruction = format.substring(0,1);
	format = format.slice(1);
	quantifier = '1';
	var q = format.match(/^(\*|\d+)/);
	if(q!==null) {
	    quantifier = q[0];
	    format = format.slice(quantifier.length);
	}
        switch (instruction) {
        case 'a': // NUL-padded string
        case 'A': // SPACE-padded string
        case 'Z': // 
            if (quantifier === '*') {
		quantifier = data.indexOf( (instruction==='A'?" ":"\0"))+1;
                if(!quantifier) quantifier = data.length;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
            currentData = data.substr(0, quantifier);
            data = data.slice(quantifier);
	    
            if (instruction === 'a') {
                currentResult = currentData.replace(/\0+$/, '');
	    }
            else if (instruction === 'A') {
                currentResult = currentData.replace(/ +$/, '');
            }
	    else { // 'Z'
		currentResult = currentData;
	    }
            result.push(currentResult);
            break;
	    
        case 'b': // 
            if (quantifier === '*') {
                quantifier = data.length;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
            currentData = data.substr(0, quantifier);
            data = data.slice(quantifier);
	    
	    currentResult = '';
            for (i=0;i<currentData.length;i++) {
		j = parseInt(currentData.charCodeAt(i));
		for(k=0; k<8; ++k) {
		    j <<= 1;
		    currentResult += (j>255) ? "1" : "0";
		    j &= 0xff;
		}
            }
            result.push(currentResult);
            break;

        case 'c': // signed char
        case 'C': // unsigned c
            if (quantifier === '*') {
                quantifier = data.length;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
            currentData = data.substr(0, quantifier);
            data = data.slice(quantifier);
	    
            for (i=0;i<currentData.length;i++) {
                currentResult = parseInt(currentData.charCodeAt(i));
                if ((instruction === 'c') && (currentResult >= 128)) {
                    currentResult -= 256;
                }
                result.push(currentResult);
            }
            break;
	    
        case 'v': // unsigned short (always 16 bit, little endian byte order)
            if (quantifier === '*') {
                quantifier = (data.length) / 2;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
            currentData = data.substr(0, quantifier*2);
            data = data.slice(quantifier*2);
            for (i=0;i<currentData.length;i+=2) {
                currentResult = parseInt(currentData.charCodeAt(i+1) << 8) +
                    parseInt(currentData.charCodeAt(i));
                result.push(currentResult);
            }
            break;
	    
        case 'V': // unsigned long (always 32 bit, little endian byte order)
            if (quantifier === '*') {
                quantifier = (data.length) / 4;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
	    
            currentData = data.substr(0, quantifier*4);
            data = data.slice(quantifier*4);
            for (i=0;i<currentData.length;i+=4) {
                currentResult =
                    parseInt((currentData.charCodeAt(i+3) & 0xFF) << 24) +
                    parseInt((currentData.charCodeAt(i+2) & 0xFF) << 16) +
                    parseInt((currentData.charCodeAt(i+1) & 0xFF) << 8) +
                    parseInt((currentData.charCodeAt(i) & 0xFF));
                result.push(currentResult);
            }
            break;
	
	case 'e':
            if (quantifier === '*') {
                quantifier = (data.length) / 4;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
	    
            currentData = data.substr(0, quantifier*4);
            data = data.slice(quantifier*4);
            for (i=0;i<currentData.length;i+=4) {
                currentResult = decodeIEEE754(currentData.substring(i*4, i*4+4));
                result.push(currentResult);
            }
            break;
	    
	case 'E':
            if (quantifier === '*') {
                quantifier = (data.length) / 8;
            } else {
                quantifier = parseInt(quantifier, 10);
            }
	    
            currentData = data.substr(0, quantifier*8);
            data = data.slice(quantifier*8);
            for (i=0;i<currentData.length;i+=8) {
                currentResult = decodeIEEE754(currentData.substring(i*8, i*8+8));
                result.push(currentResult);
            }
            break;
	    
        default:
            throw 'Warning:  unpack() Type ' + instruction + ': unknown format code';
	}
    }
    return result;
};


exports.pack = function(format) {
    var result = "";
    var instruction, quantifier, currentData;
    var argumentPointer = 1;
    var args = arguments;
    if(args[1].constructor.toString().indexOf(" Array(") >= 0) {
	args = args[1];
	argumentPointer = 0;
    }
    
    while(format) {
	instruction = format.substring(0,1);
	format = format.slice(1);
	quantifier = '1';
	var q = format.match(/^(\*|\d+)/);
	if(q!==null) {
	    quantifier = q[0];
	    format = format.slice(quantifier.length);
	}
	
	switch (instruction) {
        case 'a': //NUL-padded string            
        case 'A': //SPACE-padded string
        case 'Z':
            if (typeof args[argumentPointer] === 'undefined') {
                throw new Error('Warning: pack() Type ' + instruction +
                       ': not enough arguments');
            } else {
                argument = String(args[argumentPointer]);
            }
            if (quantifier === '*') {
                quantifier = argument.length + ((instruction === 'a') ? 1 : 0);
            }
            for (i = 0; i < quantifier; i ++) { 
		if (typeof(argument[i]) === 'undefined') {
                    if (instruction === 'a') {
                        result += String.fromCharCode(0);
                    } else {
                        result += ' ';
                    }
                } else {
                    result += argument[i];
                }
            }
	    argumentPointer++;
            break;
	    
        case 'c': //signed char
        case 'C': //unsigned char
            //c and C is the same in pack
            if (quantifier === '*') {
                quantifier = args.length - argumentPointer;
	    }
            if (quantifier > (args.length - argumentPointer)) {
                throw new Error('Warning: pack() Type ' + instruction +
                        ': too few arguments');
            } 
            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(args[argumentPointer]);
                argumentPointer++;
            }
	    break;

        case 'v':            //s and S is the same in pack
            //but can machine byte order be retrieved in javascript?
            //this is default byte order anywayz...
            if (quantifier === '*') {
                quantifier = args.length - argumentPointer;
	    }
            if (quantifier > (args.length - argumentPointer)) {
                throw new Error('Warning: pack() Type ' + instruction +
                        ': too few arguments');
            } 
            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(args[argumentPointer] &
                        0xFF);
                result += String.fromCharCode(args[argumentPointer] >> 8 & 0xFF);
                argumentPointer++;
            }
            break;
	    
        case 'V': // unsigned long (always 32 bit, little endian byte order)
            if (quantifier === '*') {
                quantifier = args.length - argumentPointer;
	    }
            if (quantifier > (args.length - argumentPointer)) {
                throw new Error('Warning: pack() Type ' + instruction +
                        ': too few arguments');
            } 
            for (i = 0; i < quantifier; i++) {
                result += String.fromCharCode(args[argumentPointer] & 0xFF);
                result += String.fromCharCode(args[argumentPointer] >> 8 & 0xFF);
                result += String.fromCharCode(args[argumentPointer] >> 16 & 0xFF);
                result += String.fromCharCode(args[argumentPointer] >> 24 & 0xFF);
                argumentPointer++;
            }
            break;

        case 'e': // IEEE754 32bit
            if (quantifier === '*') {
                quantifier = args.length - argumentPointer;
	    }
            if (quantifier > (args.length - argumentPointer)) {
                throw new Error('Warning: pack() Type ' + instruction +
                        ': too few arguments');
            } 

            for (i = 0; i < quantifier; i++) {
		result += encodeIEEE754(args[argumentPointer], 'float');
                argumentPointer++;
            }
            break;
	    
        case 'E': // IEEE754 64bit
            if (quantifier === '*') {
                quantifier = args.length - argumentPointer;
	    }
            if (quantifier > (args.length - argumentPointer)) {
                throw new Error('Warning: pack() Type ' + instruction +
                        ': too few arguments');
            } 

            for (i = 0; i < quantifier; i++) {
		result += encodeIEEE754(args[argumentPointer], 'double');
                argumentPointer++;
            }
            break;

        default:
            throw 'Warning: pack() Type ' + instruction + ': unknown format code';
	}
    }
    return result;
};


var encodeIEEE754 = function(val, type) {
    var config = {
	'double': {
	    bias: 1023,
	    bytes: 8,
	    exp: 11,
	    
	    POSITIVE_INFINITY: Number.POSITIVE_INFINITY,
	    NEGATIVE_INFINITY: Number.NEGATIVE_INFINITY,
	    
	    qNAN: String.fromCharCode(0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff),
	    pINF: String.fromCharCode(0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
	    nINF: String.fromCharCode(0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00),
	    zero: String.fromCharCode(0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00)
	},
	'float': {
	    bias: 127,
	    bytes: 4,
	    exp: 8,
	    
	    POSITIVE_INFINITY: (2 - Math.pow(2, -23)) * Math.pow(2, 127),
	    NEGATIVE_INFINITY: -(2 - Math.pow(2, -23)) * Math.pow(2, 127),
	    
	    qNAN: String.fromCharCode(0xff, 0xff, 0xff, 0xff),
	    pINF: String.fromCharCode(0x7f, 0x80, 0x00, 0x00),
	    nINF: String.fromCharCode(0xff, 0x80, 0x00, 0x00),
	    zero: String.fromCharCode(0x00, 0x00, 0x00, 0x00)
	}
    }[type || 'double'];
    
    if ( isNaN(val) )  return config.qNAN;
    if ( val >= config.POSITIVE_INFINITY ) return config.pINF;
    if ( val <= config.NEGATIVE_INFINITY ) return config.nINF;
    if ( Math.abs(val) == 0 )  return config.zero;

    var zeropadding = function(val,len,prepare) {
	var padding = "0000000000".substring(0,len-val.length);
	return prepare ? padding+val : val+padding;
    }
    var bval = Math.abs(val).toString(2);
    var exp = bval.indexOf(".") - 1 + config.bias;
    var bfrac = bval.replace(".", "");
    exp -= bfrac.indexOf("1");
    bfrac = bfrac.substring(bfrac.indexOf("1")+1);
    var bits = (val<0?"1":"0")+zeropadding(exp.toString(2), config.exp, true)+bfrac;

    result = [];
    for (var i = 0; i < config.bytes; i++) {
	result.push(String.fromCharCode(parseInt(zeropadding(bits.substring(i*8,i*8+8),8,false),2)));
    }
    
    return result.reverse().join("");
};


var decodeIEEE754 = function(data) {
    var bits = data.split('').map(function(s){return s.charCodeAt(0);}).reverse();
    var n = bits.length;
    var config = {
	4: {
	    bias: 127,
	    sgnd: 23,
	    pbias: Math.pow(2, 126),
	    psgnd: Math.pow(2, 23)
	},
	8: {
	    bias: 1023,
	    sgnd: 52,
	    pbias: Math.pow(2, 1022),
	    psgnd: Math.pow(2, 52)
	}
    }[n];

    var e, m;
    if ( n == 4 ) {
        e = ((bits[0] & 0x7f) << 1) + (bits[1] >> 7);
        m = bits[1] & 0x7f;
    }
    else if ( n == 8 ) {
        e = ((bits[0] & 0x7f) << 4) + (bits[1] >> 4);
        m = bits[1] & 0x0f;
    }
    else {
        throw "Range error";
    }

    s = bits[0] & 0x80;
    for (var i = 2; i < n; i++) {
        m = m * 0x100 + bits[i];
    }

    // e = 0xff, 0x7ff - +INF, -INF or NAN
    if ( e == config.bias * 2 + 1 ) {
        // NAN
        if ( m ) {
            return 0 / 0;
        }

        // +INF, -INF
        return (s ? -1 : +1) / 0;
    }

    var result = e 
        ? (m / config.psgnd + 1) * Math.pow(2, e - config.bias) 
        : m / config.psgnd / config.pbias;
    
    return s ? -result : result;
};

/*
node-mysql
A node.js interface for MySQL

Author: masuidrive <masui@masuidrive.jp>
License: MIT License
Copyright (c) Yuichiro MASUI
*/

// pack/unpack Original
// MIT license http://phpjs.org/functions/pack:880
// http://kevin.vanzonneveld.net
// +   original by: Tim de Koning (http://www.kingsquare.nl)
// +      parts by: Jonas Raoni Soares Silva
// +      http://www.jsfromhell.com    // %        note 1: Float encoding by: Jonas Raoni Soares Silva

// encode/decodeFloat Original
// http://snippets.dzone.com/posts/show/685