/*
 * The JavaScript implementation of the Secure Hash Algorithm 1
 *
 *   Copyright (c) 2008  Takanori Ishikawa  <takanori.ishikawa@gmail.com>
 *   All rights reserved.
 *
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions
 *   are met:
 * 
 *   1. Redistributions of source code must retain the above copyright
 *      notice, this list of conditions and the following disclaimer.
 *
 *   2. Redistributions in binary form must reproduce the above copyright
 *      notice, this list of conditions and the following disclaimer in the
 *      documentation and/or other materials provided with the distribution.
 *
 *   3. Neither the name of the authors nor the names of its contributors
 *      may be used to endorse or promote products derived from this
 *      software without specific prior written permission.
 *
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 *   A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 *   OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 *   SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 *   TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 *   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
/**
 * This is the javascript file for code which implements
 * the Secure Hash Algorithm 1 as defined in FIPS 180-1 published April 17, 1995.
 *
 *   Author: Takanori Ishikawa <takanori.ishikawa@gmail.com>
 *   Copyright: Takanori Ishikawa 2008
 *   License: BSD License (see above)
 *
 * NOTE:
 *   Only 8-bit string is supported, please use encodeURIComponent() function 
 *   if you want to hash multibyte string.
 *
 * Supported Browsers:
 *   [Win] IE 6, Firefox 2
 *   [Mac] Safari 3, Firefox 2
 *
 * Usage:
 *   var hexdigest = new SHA1("Hello.").hexdigest(); // "9b56d519ccd9e1e5b2a725e186184cdc68de0731"
 *
 * See Also:
 *   FIPS 180-1 - Secure Hash Standard
 *   http://www.itl.nist.gov/fipspubs/fip180-1.htm
 *
 */

var SHA1 = (function(){

  /**
   * Spec is the BDD style test utilities.
   */
  var Spec = {
    /** Replace the Spec.describe function with empty function if false. */
    enabled: true,
    
    /** Indicates whether object 'a' is "equal to" 'b'. */
    equals: function(a, b) {
      if (a instanceof Array && b instanceof Array) {
        if (a.length != b.length) return false;
        for (var i = 0; i < a.length; i++) if (!Spec.equals(a[i], b[i])) return false;
        return true;
      }
      if ((a != null && b != null) && (typeof a == "object" && typeof b == "object")) {
        for (var i in a) if (!Spec.equals(a[i], b[i])) return false;
        return true;
      }
      return (a == b);
    },
    
    /** equivalent to xUint's assert */
    should: function(expection, message) {
      Spec.currentIndicator++;
      if (!expection) {
        var warning = [
          "[Spec failed",
          Spec.currentTitle ? " (" + Spec.currentTitle + ")] " : "] ",
          (message || (Spec.currentMessage + " " + Spec.currentIndicator) || "")
        ].join("");
        
        alert(warning);
        throw warning;
      }
      return !!expection;
    },
    
    /** Write your specification by using describe method. */
    describe: function(title, spec) {
      Spec.currentTitle = title;
      for (var name in spec) {
        Spec.currentMessage = name;
        Spec.currentIndicator = 0;
        spec[name]();
        Spec.currentIndicator = null;
      }
      Spec.currentMessage = Spec.currentTitle = null;
    },
    Version: "0.1"
  };
  
  // Other BDD style stuffs.
  Spec.should.equal = function(a, b, message) { return Spec.should(Spec.equals(a, b), message); };
  Spec.should.not = function(a, message) { return Spec.should(!a, message); };
  Spec.should.not.equal = function(a, b, message) { return Spec.should(!Spec.equals(a, b), message); };
  if (!Spec.enabled) Spec.describe = function(){};
  
  
  // self test
  Spec.describe("Spec object", {
    "should": function() {
      Spec.should(true);
      Spec.should(1);
    }, 
    "should.not": function() {
      Spec.should.not(false);
      Spec.should.not(0);
    },
    "should.equal": function() {
      Spec.should.equal(null, null);
      Spec.should.equal("", "");
      Spec.should.equal(12345, 12345);
      Spec.should.equal([0,1,2], [0,1,2]);
      Spec.should.equal([0,1,[0,1,2]], [0,1,[0,1,2]]);
      Spec.should.equal({}, {});
      Spec.should.equal({x:1}, {x:1});
      Spec.should.equal({x:[1]}, {x:[1]});
    },
    "should.not.equal": function() {
      Spec.should.not.equal([1,2,3], [1,2,3,4]);
      Spec.should.not.equal({x:1}, [1,2,3,4]);
    }
  });


  // -----------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------
  // int32 -> hexdigits string (e.g. 0x123 -> '00000123')
  function strfhex32(i32) {
    i32 &= 0xffffffff;
    if (i32 < 0) i32 += 0x100000000;
    var hex = Number(i32).toString(16);
    if (hex.length < 8) hex = "00000000".substr(0, 8 - hex.length) + hex;
    return hex;
  }
  Spec.describe("sha1", {
    "strfhex32": function() {
      Spec.should.equal(strfhex32(0x0),          "00000000");
      Spec.should.equal(strfhex32(0x123),        "00000123");
      Spec.should.equal(strfhex32(0xffffffff),   "ffffffff");
    }
  });

  // int32 -> string (e.g. 123 -> '00000000 00000000 00000000 01111011')
  function strfbits(i32) {
    if (typeof arguments.callee.ZERO32 == 'undefined') {
      arguments.callee.ZERO32 = new Array(33).join("0");
    }
    
    var bits = Number(i32).toString(2);
    // '0' padding 
    if (bits.length < 32) bits = arguments.callee.ZERO32.substr(0, 32 - bits.length) + bits;
    // split by 8 bits
    return bits.replace(/(\d{8})/g, '$1 ')
               .replace(/^\s*(.*?)\s*$/, '$1');
  }
  Spec.describe("sha1", {
    "strfbits": function() {
      Spec.should.equal(strfbits(0),   "00000000 00000000 00000000 00000000");
      Spec.should.equal(strfbits(1),   "00000000 00000000 00000000 00000001");
      Spec.should.equal(strfbits(123), "00000000 00000000 00000000 01111011");
    }
  });


  // -----------------------------------------------------------
  // SHA-1
  // -----------------------------------------------------------
  // Returns Number(32bit unsigned integer) array size to fit for blocks (512-bit strings)
  function padding_size(nbits) {
    var n = nbits + 1 + 64
    return 512 * Math.ceil(n / 512) / 32;
  }
  Spec.describe("sha1", {
    "padding_size": function() {
      Spec.should.equal(padding_size(0),             16);
      Spec.should.equal(padding_size(1),             16);
      Spec.should.equal(padding_size(512 - 64 - 1),  16);
      Spec.should.equal(padding_size(512 - 64),      32);
    }
  });

  // 8bit string -> uint32[]
  function word_array(m) {
    var nchar = m.length;
    var size = padding_size(nchar * 8);
    var words = new Array(size);
    for (var i = 0, j = 0; i < nchar; ) {
      words[j++] = ((m.charCodeAt(i++) & 0xff) << 24) | 
                   ((m.charCodeAt(i++) & 0xff) << 16) | 
                   ((m.charCodeAt(i++) & 0xff) << 8)  | 
                   ((m.charCodeAt(i++) & 0xff))
    }
    while (j < size) words[j++] = 0;
    return words;
  }
  Spec.describe("sha1", {
    "word_array": function() {
      Spec.should.equal(word_array(""), [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]);
      Spec.should.equal(word_array("1234")[0], 0x31323334);
    }
  });

  function write_nbits(words, length, nbits) {
    if (nbits > 0xffffffff) {
      var lo = nbits & 0xffffffff;
      if (lo < 0) lo += 0x100000000;
      words[length - 1] = lo;
      words[length - 2] = (nbits - lo) / 0x100000000;
    } else {
      words[length - 1] = nbits;
      words[length - 2] = 0x0;
    }
    return words;
  }
  Spec.describe("sha1", {
    "write_nbits": function() {
      Spec.should.equal(write_nbits([0, 0], 2, 1),             [0, 1]);
      Spec.should.equal(write_nbits([0, 0], 2, 0xffffffff),    [0, 0xffffffff]);
      Spec.should.equal(write_nbits([0, 0], 2, 0x100000000),   [1, 0]);
      Spec.should.equal(write_nbits([0, 0], 2, 0x1ffffffff),   [1, 0xffffffff]);
      Spec.should.equal(write_nbits([0, 0], 2, 0x12300000000), [0x123, 0]);
      Spec.should.equal(write_nbits([0, 0], 2, 0x123abcdef12), [0x123, 0xabcdef12]);
    }
  });

  function padding(words, nbits) {
    var i = Math.floor(nbits / 32);
    
    words[i] |= (1 << (((i + 1) * 32) - nbits - 1));
    write_nbits(words, padding_size(nbits), nbits);
    return words;
  }

  function digest(words) {
    var i = 0, t = 0;
    var H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    
    while (i < words.length) {
      var W = new Array(80);
      
      // (a)
      for (t = 0;  t < 16; t++) W[t] = words[i++];
      
      // (b)
      for (t = 16; t < 80; t++) {
        var w = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16];
        W[t] = (w << 1) | (w >>> 31);
      }
      
      // (c)
      var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4];
      
      // (d) TEMP = S5(A) + ft(B,C,D) + E + Wt + Kt;
      //     E = D; D = C; C = S30(B); B = A; A = TEMP;
      for (t = 0; t < 80; t++) {
        var tmp = ((A << 5) | (A >>> 27)) + E + W[t];
        
        if      (t >=  0 && t <= 19) tmp += ((B & C) | ((~B) & D))        + 0x5a827999;
        else if (t >= 20 && t <= 39) tmp += (B ^ C ^ D)                   + 0x6ed9eba1;
        else if (t >= 40 && t <= 59) tmp += ((B & C) | (B & D) | (C & D)) + 0x8f1bbcdc;
        else if (t >= 60 && t <= 79) tmp += (B ^ C ^ D)                   + 0xca62c1d6;
        
        E = D; D = C; C = ((B << 30) | (B >>> 2)); B = A; A = tmp;
      }
      
      // (e) H0 = H0 + A, H1 = H1 + B, H2 = H2 + C, H3 = H3 + D, H4 = H4 + E.
      H[0] = (H[0] + A) & 0xffffffff;
      H[1] = (H[1] + B) & 0xffffffff;
      H[2] = (H[2] + C) & 0xffffffff;
      H[3] = (H[3] + D) & 0xffffffff;
      H[4] = (H[4] + E) & 0xffffffff;
      if (H[0] < 0) H[0] += 0x100000000;
      if (H[1] < 0) H[1] += 0x100000000;
      if (H[2] < 0) H[2] += 0x100000000;
      if (H[3] < 0) H[3] += 0x100000000;
      if (H[4] < 0) H[4] += 0x100000000;
    }
    
    return H;
  }

  // message: 8bit string
  var SHA1 = function(message) {
    this.message = message;
  }

  SHA1.prototype = {
    digest: function() {
      var nbits = this.message.length * 8;
      var words = padding(word_array(this.message), nbits);
      return digest(words);
    },

    hexdigest: function() {
      var digest = this.digest();
      for (var i = 0; i < digest.length; i++) digest[i] = strfhex32(digest[i]);
      return digest.join("");
    }
  };
  
  Spec.describe("sha1", {
    "SHA1#hexdigest": function() {
      Spec.should.equal(new SHA1("").hexdigest(),       "da39a3ee5e6b4b0d3255bfef95601890afd80709");
      Spec.should.equal(new SHA1("1").hexdigest(),      "356a192b7913b04c54574d18c28d46e6395428ab");
      Spec.should.equal(new SHA1("Hello.").hexdigest(), "9b56d519ccd9e1e5b2a725e186184cdc68de0731");
      Spec.should.equal(new SHA1("9b56d519ccd9e1e5b2a725e186184cdc68de0731").hexdigest(), "f042dc98a62cbad68dbe21f11bbc1e9d416d2bf6");
      Spec.should.equal(new SHA1("MD5abZRVSXZVRcasdfasdddddddddddddddds+BNRJFSLKJFN+SEONBBJFJXLKCJFSE)RUNVXDLILKVJRN)#NVFJ)WVFWRW#)NVS$Q=$dddddddddddddWV;no9wurJFSE)RUNVXDLILKVJRN)#NVFJ)WVFWRW#)NVS$Q=$dddddddddddddWV;no9wurJFSE)RUNVXDLILKVJRN)#NVFJ)WVFWRW#)NVS$Q=$dddddddddddddWV;no9wurJFSE)RUNVXDLILKVJRN)#NVFJ)WVFWRW#)NVS$Q=$dddddddddddddWV;no9wuraddddddasdfasdfd").hexdigest(), "662dbf4ebc9cdb4224766e87634e5ba9e6de672b");
    }
  });
  
  return SHA1;
})();

exports.SHA1 = SHA1; // add for node.js
