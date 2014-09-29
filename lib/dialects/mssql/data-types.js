var DataTypes = require('../../data-types');

//drop table Group
DataTypes.BOOLEAN = 'BIT';
DataTypes.DATE = 'DATETIME2';
DataTypes.NOW = 'GETDATE()';
DataTypes.UUID = 'UNIQUEIDENTIFIER';

module.exports = DataTypes; 