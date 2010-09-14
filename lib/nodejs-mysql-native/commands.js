var sys = require('sys');
var writer = require('./serializers').writer;
var field_flags = require('./constants').field_flags;
var flags = require('./constants').flags;
var types = require('./constants').types;

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

function parseTime(s)
{
    // no parsing here with non-binary prtocol, return date as is
    return s;
}

function parseString(s)
{
    return s;
}

function parseNull(s)
{
    return null;
}

var type_parsers = {};
  type_parsers[types.MYSQL_TYPE_DECIMAL] =  parseInt;
  type_parsers[types.MYSQL_TYPE_TINY] = parseInt;
  type_parsers[types.MYSQL_TYPE_SHORT] = parseInt;
  type_parsers[types.MYSQL_TYPE_LONG] = parseInt;
  type_parsers[types.MYSQL_TYPE_FLOAT] = parseFloat;
  type_parsers[types.MYSQL_TYPE_DOUBLE] = parseFloat;
  type_parsers[types.MYSQL_TYPE_NULL] = parseNull,
  type_parsers[types.MYSQL_TYPE_TIMESTAMP] = parseTime,
  type_parsers[types.MYSQL_TYPE_LONGLONG] = parseInt;
  type_parsers[types.MYSQL_TYPE_INT24] = parseInt;
  type_parsers[types.MYSQL_TYPE_DATE] = parseTime,
  type_parsers[types.MYSQL_TYPE_TIME] = parseTime,
  type_parsers[types.MYSQL_TYPE_DATETIME] = parseTime,
  type_parsers[types.MYSQL_TYPE_YEAR] = parseTime,
  type_parsers[types.MYSQL_TYPE_NEWDATE] = parseTime,
  type_parsers[types.MYSQL_TYPE_VARCHAR] = parseString;
  //MYSQL_TYPE_BIT: ,
  //MYSQL_TYPE_NEWDECIMAL: 246,
  //MYSQL_TYPE_ENUM: 247,
  //MYSQL_TYPE_SET: 248,
  type_parsers[types.MYSQL_TYPE_TINY_BLOB] = parseString;
  type_parsers[types.MYSQL_TYPE_MEDIUM_BLOB] = parseString;
  type_parsers[types.MYSQL_TYPE_LONG_BLOB] = parseString;
  type_parsers[types.MYSQL_TYPE_BLOB] = parseString;
  type_parsers[types.MYSQL_TYPE_VAR_STRING] = parseString;
  type_parsers[types.MYSQL_TYPE_STRING] = parseString;
  //MYSQL_TYPE_GEOMETRY: 255G

/*
var type_seriliaers = {};
type_serialisers['string'] = serialiseString;

function serialiseString(a)
{
    var w = new writer();
    w.lcstring(s);
    return w.data;
}
*/

var string2type = function(str, t)
{
    return type_parsers[t](str);
}

var mysql_type = function(js_type)
{
}


var crypto = require('crypto');
function sha1(msg)
{
    var hash = crypto.createHash('sha1');
    hash.update(msg);
    return hash.digest('binary');
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


//
// base for all commands
// initialises EventEmitter and implemets state mashine
//
function cmd(handlers)
{
    var ee = new process.EventEmitter();
    this.state = "start";
    // mixin all handlers  
    for (h in handlers)
    {
        if(handlers.hasOwnProperty(h)) 
        {
            this[h] = handlers[h];
        }
    }    

    // delegate to private EventEmitter member
    this.emit = function()
    {
       ee.emit.apply(ee, arguments);
    }
    this.on = this.addListener = function()
    {
       ee.addListener.apply(ee, arguments);
       return this;
    }

    this.process_packet = function(r)
    {
        if (r && r.isErrorPacket())
        {
            var error = r.readOKpacket();
            ee.emit('error', error);
            return true;
        }
 
        var next_state = this[this.state].apply(this, arguments);
        if (next_state)
        {
            this.state = next_state;
        }
        if (this.state == "done")
        {
           ee.emit('end', this);
           return true;
        }
        if (this.state == "error")
           return true;
        return false;
    }

    this.write = function(packet, pnum)
    {
        this.connection.write_packet(packet,pnum);    
    }

    this.store_column = function(r,f,v)
    {
        if (this.connection.row_as_hash)
            r[f.name] = v;
        else
            r.push(v);
    }
} 

function auth(db, user, password)
{
    if (!user)
        user='';

    var c = new cmd( 
    {
        start: function() { return 'read_status'; },
        read_status: function( r )
        {
            c.serverStatus.protocolVersion = r.bytes(1);
            c.serverStatus.serverVersion = r.zstring();
            c.serverStatus.threadId = r.num(4);
            var salt = r.bytes(8);
            // TODO: whats this? comment and add fields o sercerStatus
            r.bytes(1);
            r.bytes(5);
            r.bytes(1);
            r.bytes(12);
            salt += r.bytes(12);

            var token = (password || password === "") ? scramble(password, salt) : "";
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

function query(sql)
{
    var c = new cmd(
    {
        start: function()
        {
            this.write( new writer().add("\u0003").add(this.sql) );
            return 'rs_ok';
        },
        rs_ok: function( r )
        {
            var ok = r.readOKpacket();
            this.insert_id = ok.insert_id;
            this.affected_rows = ok.affected_rows;
            if (ok.field_count == 0)
            { 
                return 'done';
            }
            this.fields = [];
            return 'handle_fields';
        },
        handle_fields: function( r )
        {
            if (r.isEOFpacket())
            {
                this.emit('fields_eof');
                return 'data';
            }
            var f = r.field();
            this.emit('field', f);
            this.fields.push(f);
        },
        data: function( r )
        {
            if (r.isEOFpacket())
            {
                return 'done';
            }

            var row = this.connection.row_as_hash ? {} : [];
            var field_index = 0;
            while (!r.eof())
            {
                var field = this.fields[field_index];
                var strValue = r.lcstring();
                var value = string2type(strValue, field.type); // todo: move to serialiser unpackString
                this.store_column(row, field, value)
                field_index++;
            }
            this.emit('row', row, this.fields);
        }
    });
    c.sql = sql;
    return c;
}

function prepare(sql)
{
    return new cmd(
    {
        start: function()
        {
           //if (this.connection.pscache[sql])
           //    return 'done';
           this.write( new writer().add("\u0016").add(sql) );
           return 'ps_ok';
        },
        ps_ok: function( r )
        {
           this.ps = {};
           var ok = r.bytes(1);
           this.ps.statement_handler_id = r.num(4);
           this.ps.field_count = r.num(2);
           this.ps.num_params = r.num(2);
           r.bytes(1); // filler, should be 0
           
           if (!this.connection.pscache)
               this.connection.pscache = {};
           this.connection.pscache[sql] = this.ps;
           this.emit('ok', this.ps);
           this.ps.fields = [];
           this.ps.parameters = [];
           if (this.ps.num_params > 0)
               return 'params';
           if (this.ps.field_count == 0)
               return 'done';
           return 'fields';
        },
        params: function( r )
        {
            if (r.isEOFpacket())
            {
                 if (this.ps.field_count == 0)
                      return 'done';
                 return 'fields';
            }
            //var p = r.parameter();
            var p = r.field();
            this.ps.parameters.push(p);
        },
        fields: function( r )
        {
            if (r.isEOFpacket())
            {
                return 'done';
            }
            var f = r.field();
            this.ps.fields.push(f);
            this.emit('field', f);
        }        
    }

    );
}


function execute(sql, parameters)
{
    var ps;
    return new cmd(
    {
        start: function()
        {
           if (this.prepare_failed)
               return 'done';

           if (!this.ps && this.connection.pscache)
               this.ps = this.connection.pscache[sql];
           if (!this.ps)
           {
               var error = { message: 'Prepared statement \"' + sql + '\" not found', errno: 0 };
               this.emit('error', error);
               return 'done';
           }
           var packet = new writer().add("\u0017").add(this.ps.statement_handler_id).add("\u0000\u0001\u0000\u0000\u0000");
           if ( parameters )
           {
               var null_bit_map = "";
               var mask = 1;        
               var bit_map = 0; 
               for (var p=0; p < parameters.length; ++p)
               {
                   if (parameters[p] == null)
                       bit_map += mask;
                   mask = mask*2;
                   if (mask == 256)
                   {
                       null_bit_map += String.fromCharCode(bit_map);
                       mask = 1;
                       bit_map = 0;
                   }
               }
               null_bit_map += String.fromCharCode(bit_map);

               packet.add(null_bit_map);
               // todo: set types only on first call
               packet.add('\u0001');
               // todo: add numeric/datetime serialisers
               for (var i = 0; i < parameters.length; i++)
               {
                   if (parameters[i] != null)
                       packet.int2(types.MYSQL_TYPE_VAR_STRING);
               }
               for (var i = 0; i < parameters.length; i++)
               {
                   if (parameters[i] != null)
                       packet.lcstring(parameters[i].toString());
               }                          
           }
           this.write( packet ); 
           return 'execute_ok';
        },
        execute_ok: function(r)
        {
           var ok = r.readOKpacket();
           this.insert_id = ok.insert_id;
           this.affected_rows = ok.affected_rows;
           if (this.ps.field_count == 0)
               return 'done';
           return 'fields';
        },
        fields: function( r )
        {
            if (r.isEOFpacket())
            {
                this.emit('fields_eof');
                return 'binrow';
            }
            var f = r.field();
            this.emit('field', f);
        },
        binrow: function( r )
        {
            if (r.isEOFpacket())
               return 'done';

            var null_bit_map = [];
            r.num(1); // first octet always 0
            var bit = 4;
            var bitmap_byte;
            if (this.ps.field_count > 0)
                bitmap_byte = r.num(1);
            var numfields = this.ps.field_count;
            for (var f=0; f < numfields; ++f)
            {
                null_bit_map.push( (bitmap_byte & bit) != 0);
                if (!((bit<<=1) & 255) && f + 1 < numfields)
                {
                    bit= 1;
                    bitmap_byte = r.num(1);
                }    
            }

            var row = this.connection.row_as_hash ? {} : [];
            for (var f=0; f < this.ps.field_count; ++f)
            {
                var field = this.ps.fields[f];
                if (!null_bit_map[f])
                {
                    var value = r.unpackBinary(field.type, field.flags & field_flags.UNSIGNED);
                    this.store_column(row, field, value);
                } else {
                    this.store_column(row, field, null);
                }
            }
            this.emit('row', row);
        }

    });
}

function close()
{
   return new cmd(
       {
          start: function()
          {
              this.connection.terminate();
              return 'done';
          }
      }
   );
}

function debug( text )
{
   return new cmd(
       {
          start: function()
          {
              sys.puts(text);
              return 'done';
          }
      }
   );
}

exports.auth = auth;
exports.close = close;
exports.query = query;
exports.prepare = prepare;
exports.execute = execute;
exports.debug = debug;
