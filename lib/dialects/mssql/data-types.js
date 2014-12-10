'use strict';

var DataTypes = require('../../data-types');

//drop table Group
DataTypes.BOOLEAN = 'BIT';
DataTypes.NOW = 'GETDATE()';
DataTypes.UUID = 'UNIQUEIDENTIFIER';
DataTypes.BLOB = 'VARBINARY(MAX)';
DataTypes.STRING._typeName = 'NVARCHAR';

DataTypes.STRING.prototype = {
  get BINARY() {
    this._binary = true;
    return this;
  },
  get type() {
    return this.toString();
  },
  toString: function() {
    if(!this._binary){
      return 'NVARCHAR(' + this._length + ')';
    }else{
      return 'BINARY(' + this._length + ')';
    }
  }
};

module.exports = DataTypes;
