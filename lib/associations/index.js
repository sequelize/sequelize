'use strict';

var Association = require('./base');
Association.BelongsTo = require('./belongs-to');
Association.HasOne = require('./has-one');
Association.HasMany = require('./has-many');
Association.BelongsToMany = require('./belongs-to-many');

module.exports = Association;
