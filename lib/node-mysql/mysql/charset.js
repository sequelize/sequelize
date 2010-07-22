var sys=require('sys');
exports.Charset = function(number, name, csname) {
    this.number = number;
    this.name = name;
    this.csname = csname;
    if(this.name=='utf8') {
	this.convertToBytes = convertUTF8ToBytes;
	this.convertFromBytes = convertUTF8FromBytes;
    }
}

exports.Charset.by_number = function(n) {
  for(var i=0; i<charset.length; ++i) {
      if(n==charset[i][0])
	  return(new exports.Charset(charset[i][0], charset[i][1], charset[i][2]));
  }
  return undefined;
}

exports.Charset.by_name = function(n) {
  for(var i=0; i<charset.length; ++i) {
      if(n==charset[i][2])
	  return(new exports.Charset(charset[i][0], charset[i][1], charset[i][2]));
  }
  return undefined;
}

exports.Charset.prototype.convertToBytes = function(str) {
    return str;
}

exports.Charset.prototype.convertFromBytes = function(bytes) {
    return bytes;
}

// "あい" => "\xE3\x81\x82\xE3\x81\x84"  // UTF-8
var convertUTF8ToBytes = function(str) {
    if(typeof(str)=='undefined') return undefined;
    if(typeof(str)=='undefined') return undefined;
    
    var surrogate_1st = 0;
    var unicode_codes = [];
    for (var i = 0; i < str.length; ++i) {
	var utf16_code = str.charCodeAt(i);
	if (surrogate_1st != 0) {
	    if (utf16_code >= 0xdc00 && utf16_code <= 0xdfff) {
		var surrogate_2nd = utf16_code;
		var unicode_code = (surrogate_1st - 0xd800) * (1 << 10) + (1 << 16) +
                    (surrogate_2nd - 0xdc00);
		unicode_codes.push(unicode_code);
	    }
	    surrogate_1st = 0;
	}
	else if (utf16_code >= 0xd800 && utf16_code <= 0xdbff) {
	    surrogate_1st = utf16_code;
	}
	else {
	    unicode_codes.push(utf16_code);
	}
    }
    
    var utf8_bytes = "";
    var i, unicode_code;
    for(i=0; i<unicode_codes.length; ++i) {
	unicode_code = unicode_codes[i];
	if (unicode_code < 0x80) {  // 1-byte
	    utf8_bytes += String.fromCharCode(unicode_code);
	}
	else if (unicode_code < (1 << 11)) {  // 2-byte
	    utf8_bytes += String.fromCharCode((unicode_code >>> 6) | 0xC0);
	    utf8_bytes += String.fromCharCode((unicode_code & 0x3F) | 0x80);
	}
	else if (unicode_code < (1 << 16)) {  // 3-byte
	    utf8_bytes += String.fromCharCode((unicode_code >>> 12) | 0xE0);
	    utf8_bytes += String.fromCharCode(((unicode_code >> 6) & 0x3f) | 0x80);
	    utf8_bytes += String.fromCharCode((unicode_code & 0x3F) | 0x80);
	}
	else if (unicode_code < (1 << 21)) {  // 4-byte
	    utf8_bytes += String.fromCharCode((unicode_code >>> 18) | 0xF0);
	    utf8_bytes += String.fromCharCode(((unicode_code >> 12) & 0x3F) | 0x80);
	    utf8_bytes += String.fromCharCode(((unicode_code >> 6) & 0x3F) | 0x80);
	    utf8_bytes += String.fromCharCode((unicode_code & 0x3F) | 0x80);
	}
    }
    return utf8_bytes;
}

var convertUTF8FromBytes = function(str) {
    if(typeof(str)=='undefined') return undefined;

    var unicode_str = "";
    var unicode_code = 0;
    var num_followed = 0;
    var utf8_byte;
    for (var i = 0; i < str.length; ++i) {
	utf8_byte = str.charCodeAt(i)
	if (utf8_byte >= 0x100) {
	    // Malformed utf8 byte ignored.
	}
	else if ((utf8_byte & 0xc0) == 0x80) {
	    if (num_followed > 0) {
		unicode_code = (unicode_code << 6) | (utf8_byte & 0x3f);
		num_followed -= 1;
	    } else {
		// Malformed UTF-8 sequence ignored.
	    }
	}
	else {
	    if (num_followed == 0) {
		unicode_str += String.fromCharCode(unicode_code);
	    }
	    else {
		// Malformed UTF-8 sequence ignored.
	    }
	    if (utf8_byte < 0x80){  // 1-byte
		unicode_code = utf8_byte;
		num_followed = 0;
	    } else if ((utf8_byte & 0xe0) == 0xc0) {  // 2-byte
		unicode_code = utf8_byte & 0x1f;
		num_followed = 1;
	    } else if ((utf8_byte & 0xf0) == 0xe0) {  // 3-byte
		unicode_code = utf8_byte & 0x0f;
		num_followed = 2;
	    } else if ((utf8_byte & 0xf8) == 0xf0) {  // 4-byte
		unicode_code = utf8_byte & 0x07;
		num_followed = 3;
	    } else {
		// Malformed UTF-8 sequence ignored.
	    }
	}
    }
    if (num_followed == 0) {
	unicode_str += String.fromCharCode(unicode_code);
    } else {
	// Malformed UTF-8 sequence ignored.
    }
    
    return unicode_str.substring(1);

}


// [[charset_number, charset_name, collation_name, default], ...]
var charset = [
               [  1, "big5",     "big5_chinese_ci",      true ],
               [  2, "latin2",   "latin2_czech_cs",      false],
               [  3, "dec8",     "dec8_swedish_ci",      true ],
               [  4, "cp850",    "cp850_general_ci",     true ],
               [  5, "latin1",   "latin1_german1_ci",    false],
               [  6, "hp8",      "hp8_english_ci",       true ],
               [  7, "koi8r",    "koi8r_general_ci",     true ],
               [  8, "latin1",   "latin1_swedish_ci",    true ],
               [  9, "latin2",   "latin2_general_ci",    true ],
               [ 10, "swe7",     "swe7_swedish_ci",      true ],
               [ 11, "ascii",    "ascii_general_ci",     true ],
               [ 12, "ujis",     "ujis_japanese_ci",     true ],
               [ 13, "sjis",     "sjis_japanese_ci",     true ],
               [ 14, "cp1251",   "cp1251_bulgarian_ci",  false],
               [ 15, "latin1",   "latin1_danish_ci",     false],
               [ 16, "hebrew",   "hebrew_general_ci",    true ],
               [ 17, "filename", "filename",             true ],
               [ 18, "tis620",   "tis620_thai_ci",       true ],
               [ 19, "euckr",    "euckr_korean_ci",      true ],
               [ 20, "latin7",   "latin7_estonian_cs",   false],
               [ 21, "latin2",   "latin2_hungarian_ci",  false],
               [ 22, "koi8u",    "koi8u_general_ci",     true ],
               [ 23, "cp1251",   "cp1251_ukrainian_ci",  false],
               [ 24, "gb2312",   "gb2312_chinese_ci",    true ],
               [ 25, "greek",    "greek_general_ci",     true ],
               [ 26, "cp1250",   "cp1250_general_ci",    true ],
               [ 27, "latin2",   "latin2_croatian_ci",   false],
               [ 28, "gbk",      "gbk_chinese_ci",       true ],
               [ 29, "cp1257",   "cp1257_lithuanian_ci", false],
               [ 30, "latin5",   "latin5_turkish_ci",    true ],
               [ 31, "latin1",   "latin1_german2_ci",    false],
               [ 32, "armscii8", "armscii8_general_ci",  true ],
               [ 33, "utf8",     "utf8_general_ci",      true ],
               [ 34, "cp1250",   "cp1250_czech_cs",      false],
               [ 35, "ucs2",     "ucs2_general_ci",      true ],
               [ 36, "cp866",    "cp866_general_ci",     true ],
               [ 37, "keybcs2",  "keybcs2_general_ci",   true ],
               [ 38, "macce",    "macce_general_ci",     true ],
               [ 39, "macroman", "macroman_general_ci",  true ],
               [ 40, "cp852",    "cp852_general_ci",     true ],
               [ 41, "latin7",   "latin7_general_ci",    true ],
               [ 42, "latin7",   "latin7_general_cs",    false],
               [ 43, "macce",    "macce_bin",            false],
               [ 44, "cp1250",   "cp1250_croatian_ci",   false],
               [ 47, "latin1",   "latin1_bin",           false],
               [ 48, "latin1",   "latin1_general_ci",    false],
               [ 49, "latin1",   "latin1_general_cs",    false],
               [ 50, "cp1251",   "cp1251_bin",           false],
               [ 51, "cp1251",   "cp1251_general_ci",    true ],
               [ 52, "cp1251",   "cp1251_general_cs",    false],
               [ 53, "macroman", "macroman_bin",         false],
               [ 57, "cp1256",   "cp1256_general_ci",    true ],
               [ 58, "cp1257",   "cp1257_bin",           false],
               [ 59, "cp1257",   "cp1257_general_ci",    true ],
               [ 63, "binary",   "binary",               true ],
               [ 64, "armscii8", "armscii8_bin",         false],
               [ 65, "ascii",    "ascii_bin",            false],
               [ 66, "cp1250",   "cp1250_bin",           false],
               [ 67, "cp1256",   "cp1256_bin",           false],
               [ 68, "cp866",    "cp866_bin",            false],
               [ 69, "dec8",     "dec8_bin",             false],
               [ 70, "greek",    "greek_bin",            false],
               [ 71, "hebrew",   "hebrew_bin",           false],
               [ 72, "hp8",      "hp8_bin",              false],
               [ 73, "keybcs2",  "keybcs2_bin",          false],
               [ 74, "koi8r",    "koi8r_bin",            false],
               [ 75, "koi8u",    "koi8u_bin",            false],
               [ 77, "latin2",   "latin2_bin",           false],
               [ 78, "latin5",   "latin5_bin",           false],
               [ 79, "latin7",   "latin7_bin",           false],
               [ 80, "cp850",    "cp850_bin",            false],
               [ 81, "cp852",    "cp852_bin",            false],
               [ 82, "swe7",     "swe7_bin",             false],
               [ 83, "utf8",     "utf8_bin",             false],
               [ 84, "big5",     "big5_bin",             false],
               [ 85, "euckr",    "euckr_bin",            false],
               [ 86, "gb2312",   "gb2312_bin",           false],
               [ 87, "gbk",      "gbk_bin",              false],
               [ 88, "sjis",     "sjis_bin",             false],
               [ 89, "tis620",   "tis620_bin",           false],
               [ 90, "ucs2",     "ucs2_bin",             false],
               [ 91, "ujis",     "ujis_bin",             false],
               [ 92, "geostd8",  "geostd8_general_ci",   true ],
               [ 93, "geostd8",  "geostd8_bin",          false],
               [ 94, "latin1",   "latin1_spanish_ci",    false],
               [ 95, "cp932",    "cp932_japanese_ci"  ,  true ],
               [ 96, "cp932",    "cp932_bin"          ,  false],
               [ 97, "eucjpms",  "eucjpms_japanese_ci",  true ],
               [ 98, "eucjpms",  "eucjpms_bin",          false],
               [ 99, "cp1250",   "cp1250_polish_ci",     false],
               [128, "ucs2",     "ucs2_unicode_ci",      false],
               [129, "ucs2",     "ucs2_icelandic_ci",    false],
               [130, "ucs2",     "ucs2_latvian_ci",      false],
               [131, "ucs2",     "ucs2_romanian_ci",     false],
               [132, "ucs2",     "ucs2_slovenian_ci",    false],
               [133, "ucs2",     "ucs2_polish_ci",       false],
               [134, "ucs2",     "ucs2_estonian_ci",     false],
               [135, "ucs2",     "ucs2_spanish_ci",      false],
               [136, "ucs2",     "ucs2_swedish_ci",      false],
               [137, "ucs2",     "ucs2_turkish_ci",      false],
               [138, "ucs2",     "ucs2_czech_ci",        false],
               [139, "ucs2",     "ucs2_danish_ci",       false],
               [140, "ucs2",     "ucs2_lithuanian_ci",   false],
               [141, "ucs2",     "ucs2_slovak_ci",       false],
               [142, "ucs2",     "ucs2_spanish2_ci",     false],
               [143, "ucs2",     "ucs2_roman_ci",        false],
               [144, "ucs2",     "ucs2_persian_ci",      false],
               [145, "ucs2",     "ucs2_esperanto_ci",    false],
               [146, "ucs2",     "ucs2_hungarian_ci",    false],
               [192, "utf8",     "utf8_unicode_ci",      false],
               [193, "utf8",     "utf8_icelandic_ci",    false],
               [194, "utf8",     "utf8_latvian_ci",      false],
               [195, "utf8",     "utf8_romanian_ci",     false],
               [196, "utf8",     "utf8_slovenian_ci",    false],
               [197, "utf8",     "utf8_polish_ci",       false],
               [198, "utf8",     "utf8_estonian_ci",     false],
               [199, "utf8",     "utf8_spanish_ci",      false],
               [200, "utf8",     "utf8_swedish_ci",      false],
               [201, "utf8",     "utf8_turkish_ci",      false],
               [202, "utf8",     "utf8_czech_ci",        false],
               [203, "utf8",     "utf8_danish_ci",       false],
               [204, "utf8",     "utf8_lithuanian_ci",   false],
               [205, "utf8",     "utf8_slovak_ci",       false],
               [206, "utf8",     "utf8_spanish2_ci",     false],
               [207, "utf8",     "utf8_roman_ci",        false],
               [208, "utf8",     "utf8_persian_ci",      false],
               [209, "utf8",     "utf8_esperanto_ci",    false],
               [210, "utf8",     "utf8_hungarian_ci",    false],
               [254, "utf8",     "utf8_general_cs",      false],
              ];



/*
node-mysql
A node.js interface for MySQL
http://github.com/masuidrive/node-mysql

Copyright (c) Yuichiro MASUI <masui@masuidrive.jp>
License: MIT License

# Original:
# http://github.com/tmtm/ruby-mysql
# Copyright (C) 2009-2010 TOMITA Masahiro
# mailto:tommy@tmtm.org
# License: Ruby's
*/
