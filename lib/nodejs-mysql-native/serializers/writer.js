var sys = require('sys')
  , constants = require('../constants');
  
function writer()
{
   this.data = "";
}

writer.prototype.zstring = function(s)
{
   this.data += s + "\u0000";
   return this;
}

//
//  length-coded number
//
//  Value Of     # Of Bytes  Description
//  First Byte   Following
//  ----------   ----------- -----------
//  0-250        0           = value of first byte
//  251          0           column value = NULL
//                           only appropriate in a Row Data Packet
//  252          2           = value of following 16-bit word
//  253          3           = value of following 24-bit word
//  254          8           = value of following 64-bit word
//
writer.prototype.lcnum = function(n)
{
   if (n < 251)
       this.data += String.fromCharCode(n);
   else if (n < 0xffff)
   {
       this.data += String.fromCharCode(252);
       this.data += String.fromCharCode( n & 0xff );
       this.data += String.fromCharCode( (n >> 8) & 0xff );
   } else if (n < 0xffffff)
   {
       this.data += String.fromCharCode(253);
       this.data += String.fromCharCode( n & 0xff );
       this.data += String.fromCharCode( (n >> 8) & 0xff );
       this.data += String.fromCharCode( (n >> 16) & 0xff );
   } 
   /*
      TODO: 64 bit number
   */
   return this;
}

//
// write length-coded string to the buffer
//
writer.prototype.lcstring = function(s)
{
   this.lcnum(s.length);
   this.data += s;
   return this;
}

writer.prototype.add = function(s)
{
   if (typeof s == "string")      // add string bufer
       this.data += s; 
   else if (typeof s == "number") // add four byte integer
   {
       this.data += String.fromCharCode( s & 0xff );
       this.data += String.fromCharCode( (s >> 8)  & 0xff );
       this.data += String.fromCharCode( (s >> 16) & 0xff );
       this.data += String.fromCharCode( (s >> 24) & 0xff );
   }
   return this;
}

writer.prototype.int2 = function(s)
{
    this.data += String.fromCharCode( s & 0xff );
    this.data += String.fromCharCode( (s >> 8)  & 0xff );
}

writer.prototype.addHeader = function(n)
{
    var length = this.data.length;
    var header = "";
    header += String.fromCharCode( length     & 0xff );
    header += String.fromCharCode( length>>8  & 0xff );
    header += String.fromCharCode( length>>16 & 0xff );
    var packet_num = n ? n : 0;
    header += String.fromCharCode( packet_num );
    this.data = header + this.data;
    return this;
}

module.exports = writer