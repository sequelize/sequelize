var sys = require('sys')
  , writer = require('../serializers/writer')
  , field_flags = require('../constants').field_flags
  , flags = require('../constants').flags
  , types = require('../constants').types
  , pack = require('../pack')
  , cmd = require('../command')
  , Charset = require('../charset').Charset;

function xor(s1, s2)
{
    var res = "";
    for (var i=0; i < 20; ++i)
    {
        var c1 = s1.charCodeAt(i);
        var c2 = s2.charCodeAt(i);
        res += String.fromCharCode( s1.charCodeAt(i) ^ s2.charCodeAt(i) );
    }
    return res;
}


//
// mysql 4.2+ authorisation protocol
// token = sha1(salt + sha1(sha1(password))) xor sha1(password)
//
function scramble(password, salt)
{
    var stage1 = sha1(password);
    var stage2 = sha1(stage1);
    var stage3 = sha1(salt + stage2);
    return xor(stage3, stage1);
}

var crypto = require('crypto');
function sha1(msg)
{
    var hash = crypto.createHash('sha1');
    hash.update(msg);
    return hash.digest('binary');
}

module.exports = function(db, user, password) {
  if (!user)
      user='';

  var c = new cmd( 
  {
      start: function() { return 'read_status'; },
      read_status: function( r )
      {
          // http://forge.mysql.com/wiki/MySQL_Internals_ClientServer_Protocol
          c.serverStatus.protocolVersion = r.bytes(1);
          c.serverStatus.serverVersion = r.zstring();
          c.serverStatus.threadId = r.num(4);
          var salt = r.bytes(8); // scramble_buff
          r.bytes(1); // (filler) always 0x00
          c.serverStatus.serverCapabilities = r.num(2); // server_capabilities
          c.serverStatus.serverLanguage = r.num(1); // server_language
          c.serverStatus.serverStatus = r.num(2);  // server_status
          c.serverStatus.serverCapabilities = r.bytes(2);  // server capabilities (two upper bytes)
          var scrambleLength = r.num(1);  // length of the scramble
          r.bytes(10); // (filler)  always 0
          salt += r.bytes(12);
          
          this.connection.charset = this.connection.get('charset') ?
            Charset.by_name( this.connection.get('charset') ) : 
            Charset.by_number( c.serverStatus.serverLanguage );

          var token = password ? scramble(password, salt) : "";
          var reply = new writer();
          var client_flags = flags.CLIENT_BASIC_FLAGS;
          reply.add(client_flags);
          reply.add(0x01000000);        //max packet length
          reply.add("\u0008");          //charset
          var filler = ""; for (var i=0; i < 23; ++i) filler += "\u0000";
          reply.add(filler);
          reply.zstring(user);
          reply.lcstring(token);
          reply.zstring(db);
          this.write(reply, 1);
          return 'check_auth_ok';
      },
      check_auth_ok: function( r ) 
      {
          var ok = r.readOKpacket();
          this.emit('authorized', c.serverStatus);
          return 'done'; 
      }        
  });
  c.state = 'start';
  c.serverStatus = {};
  return c;
}