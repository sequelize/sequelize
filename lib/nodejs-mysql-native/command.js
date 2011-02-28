var sys = require('sys')
  , error = require('./error')
  
//
// base for all commands
// initialises EventEmitter and implemets state mashine
//
function cmd(handlers)
{
  this.fieldindex = 0;
  this.state = "start";
  this.stmt = ""
  this.params = []
  
  // mixin all handlers  
  for (h in handlers)
  {
    this[h] = handlers[h];
  }
}

sys.inherits(cmd, process.EventEmitter)

cmd.prototype.process_packet = function(r) {
  if (r && r.isErrorPacket())
  {
      var reserror = r.readOKpacket();

      // build a standard error object
      var e = new error()
      e.num = reserror.errno
      e.message = reserror.message
      e.stmt = this.stmt
      if (this.params) e.params = this.params

      this.emit('error', e);
      return true;
  }

  var next_state = (this[this.state]) ? this[this.state].apply(this, arguments) : 'done'

  if (next_state) this.state = next_state;
  
  if (this.state == "done")
  {
     this.emit('end', this);
     return true;
  }
  
  if (this.state == "error") return true;
  return false;
}

cmd.prototype.write = function(packet, pnum) {
  this.connection.write_packet(packet, pnum)  
}

cmd.prototype.store_column = function(r,f,v, row_as_hash) {
  if (this.connection.get('row_as_hash') || row_as_hash)
    (f.name == '?') ? r[this.fieldindex] = v : r[f.name] = v;
  else
    r.push(v);

  // keep track of the field count. used primarily for prepared statements
  this.fieldindex++
}

module.exports = cmd