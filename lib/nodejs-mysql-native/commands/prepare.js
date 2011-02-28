var sys = require('sys');
var writer = require('../serializers/writer');
var field_flags = require('../constants').field_flags;
var flags = require('../constants').flags;
var types = require('../constants').types;
var pack = require('../pack');
var cmd = require('../command')

module.exports = function(sql)
{
    return new cmd(
    {
        start: function()
        {
           if (this.connection.pscache[sql])
               return 'done';
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
           this.ps.sql = sql
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