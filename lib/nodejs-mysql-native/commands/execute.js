var sys = require('sys')
  , writer = require('../serializers/writer')
  , field_flags = require('../constants').field_flags
  , flags = require('../constants').flags
  , types = require('../constants').types
  , pack = require('../pack')
  , cmd = require('../command')
  , prepare = require('./prepare')
  , result = require('../result')

// TODO: too many copy-paste, cleanup
module.exports = function(q, parameters)
{
    if (!this.pscache)
        this.pscache = {};
    if (this.get('auto_prepare') == true)
    {
        var cached = this.connection.pscache[q];
        if (!cached) {
            var prepare_cmd = this.add(new prepare(q));
            var execute_cmd = this.add(new execPrepared(q, parameters));
            prepare_cmd.addListener('prepared', function(ps) { execute_cmd.ps = ps; });
            prepare_cmd.addListener('error', function(err)
            {
                execute_cmd.emit('error', err);
                execute_cmd.prepare_failed = true; 
            });
            return execute_cmd;
        } else {
            var execute_cmd = this.add(new execPrepared(q, parameters));
            execute_cmd.ps = cached;
            return execute_cmd;
        }
    }            
    return this.add(new execPrepared(q, parameters));
}

function execPrepared(sql, parameters)
{
  var ps;
  return new cmd(
  {
      start: function()
      {
        this.stmt = sql
        this.params = parameters

        if (this.prepare_failed)
          return 'done';

        if (!this.ps && this.connection.pscache)
          this.ps = this.connection.pscache[sql];
          
        if (!this.ps)
        {
          var error = { message: 'Prepared statement \"' + sql + '\" not found', errno: 0 };
          this.emit('error', error);
          return 'error';
        }
         
        var packet = new writer().add("\u0017").add(this.ps.statement_handler_id).add("\u0000\u0001\u0000\u0000\u0000");

        if ( parameters && parameters.length > 0)
        {
          nb = calc_null_bitmap(parameters)
          nb.forEach(function(entry, i, nd) {
            packet.add(entry);
          })
 
          // todo: set types only on first call
          packet.add('\u0001');

          // todo: add numeric/datetime serialisers
          for (var i = 0; i < parameters.length; i++)
          {
            if (parameters[i] != null && parameters[i] != undefined)
            {
              packet.int2(types.MYSQL_TYPE_VAR_STRING);
            }
            else
            {
              packet.int2(types.MYSQL_TYPE_NULL)
            }
          }

          for (var i = 0; i < parameters.length; i++)
          {
            if (parameters[i] != null && parameters[i] != undefined)
            {
              packet.lcstring(parameters[i].toString())
            }
          }
        }

        this.write( packet ); 
        return 'execute_ok';
      },
      execute_ok: function(r)
      {
        if (!r) return 'error'
        
        this.result = new result()

        var ok = r.readOKpacket();

        if (this.ps.field_count == 0)
        {
          this.result.insert_id = ok.insert_id;
          this.result.affected_rows = ok.affected_rows;

          this.emit('result', this.result)
          return 'done';
        }

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
        {
          this.emit('result', this.result)
          return 'done';
        }

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

        var row = this.connection.get('row_as_hash') ? {} : [];
        for (var f=0; f < this.ps.field_count; ++f)
        {
            var field = this.ps.fields[f];
            if (!null_bit_map[f])
            {
                var value = r.unpackBinary(field.type, field.flags & field_flags.UNSIGNED);
                this.store_column(row, field, value, this.connection.get('row_as_hash'));
            } else {
                this.store_column(row, field, null, this.connection.get('row_as_hash'));
            }
        }
    
        this.result.rows.push(row)
        this.emit('row', row);
      }
  });
}

// this code hijacked from https://github.com/masuidrive/node-mysql/blob/master/lib/mysql/pack.js
function calc_null_bitmap(values) {  
    var val = 0, len = 0, bitmap = [];
    values.map(function(v) {
        val += (v == null || v == undefined ? 1 << len : 0);
        len += 1;
        
        if(len == 8) {
          bitmap.push(val);
          len = val = 0;
        }
        return val;
    });
    
    if(len > 0) {
      bitmap.push(val);
    }

    var packed = []
    bitmap.forEach(function(entry, i, bitmap) {
      packed[i] = pack.pack("C*", entry)
    })

    return packed
}
