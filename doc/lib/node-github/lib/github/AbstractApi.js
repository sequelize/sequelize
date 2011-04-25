/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var AbstractApi = exports.AbstractApi = function(api) {
    this.$api = api;
};

(function() {

    this.$createListener = function(callback, key) {
        return function(err, response) {
            if (err) {
                callback & callback(err);
                return;
            }
//            var sys = require("sys");
//            sys.debug("FOOO " + key + sys.inspect(response));

            callback(err, key ? response[key] : response);
        };
    };

}).call(AbstractApi.prototype);