'use strict';

var moment = require('moment')
  , path = require('path')
  , Utils = require('./utils')
  , DataTypes = require('./data-types')
  , QueryInterface = require('./query-interface');

module.exports = (function() {
  var Migration = function(migrator, p) {
    this.migrator = migrator;
    this.path = path.resolve(p);
    this.filename = Utils._.last(this.path.split(path.sep));

    var parsed = Migration.parseFilename(this.filename);

    this.migrationId = parsed.id;
    this.date = parsed.date;
    this.queryInterface = this.migrator.queryInterface;
  };

  for (var methodName in QueryInterface.prototype) {
    if (QueryInterface.prototype.hasOwnProperty(methodName) && (typeof QueryInterface.prototype[methodName]) === 'function') {
      (function(methodName) {
        Migration.prototype[methodName] = function() {
          return this.queryInterface[methodName].apply(this.queryInterface, arguments);
        };
      })(methodName);
    }
  }

  ///////////////
  // static /////
  ///////////////

  Migration.parseFilename = function(s) {
    var matches = s.match(/^((\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}))[-_].+/);

    if (matches === null) {
      throw new Error(s + ' is not a valid migration name! Use YYYYMMDDHHmmss-migration-name format.');
    }

    return {
      id: parseInt(matches[1], 10),
      date: moment(matches.slice(2, 8).join('-'), 'YYYYMMDDHHmmss')
    };
  };

  ///////////////
  // member /////
  ///////////////

  Object.defineProperty(Migration.prototype, 'migration', {
    get: function() {
      if (this.path.match(/\.coffee$/)) {
        try {
          // 1.7.x compiler registration
          require('coffee-script/register');
        } catch (e) {
          try {
            // Prior to 1.7.x compiler registration
            require('coffee-script');
          } catch (e) {
            console.log('You have to add \"coffee-script\" to your package.json.');
            process.exit(1);
          }
        }
      }

      return require(this.path);
    }
  });

  Migration.prototype.execute = function(options) {
    return new Utils.CustomEventEmitter(function(emitter) {
      options = Utils._.extend({
        method: 'up'
      }, options || {});

      this.migration[options.method].call(null, this, DataTypes, function(err) {
        if (err) {
          emitter.emit('error', err);
        } else {
          emitter.emit('success', null);
        }
      });
    }.bind(this)).run();
  };

  Migration.prototype.isBefore = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {});

    var date = Migration.parseFilename(dateString.toString() + '-foo.js').date;

    return options.withoutEqual ? (date > this.date) : (date >= this.date);
  };

  Migration.prototype.isAfter = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {});

    var date = Migration.parseFilename(dateString.toString() + '-foo.js').date;

    return options.withoutEqual ? (date < this.date) : (date <= this.date);
  };

  return Migration;
})();
