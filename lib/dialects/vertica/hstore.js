'use strict';

var hstore = require('pg-hstore')({sanitize : true});

function stringify (data) {
    if (data === null) return null;
    return hstore.stringify(data);
}

function parse (value) {
    if (value === null) return null;
    return hstore.parse(value);
}

module.exports = {
    stringify: stringify,
    parse: parse
};
