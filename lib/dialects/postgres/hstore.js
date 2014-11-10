'use strict';

var hstore = require("pg-hstore")({sanitize : true});

module.exports = {
  stringify: function(data) {
    if(data === null) return null;

    return hstore.stringify(data);
  },
  parse: function(value) {
    if(value === null) return null;

    return hstore.parse(value);
  }
};
