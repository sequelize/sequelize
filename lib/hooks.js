'use strict';

var Utils = require('./utils')
  , Promise = require('./promise')
  , Stack = require( 'stack-queue' );

/**
 * Hooks are function that are called before and after  (bulk-) creation/updating/deletion and validation. Hooks can be added to you models in three ways:
 *
 * 1. By specifying them as options in `sequelize.define`
 * 2. By calling `hook()` with a string and your hook handler function
 * 3. By calling the function with the same name as the hook you want

 * ```js
 * // Method 1
 * sequelize.define(name, { attributes }, {
 *   hooks: {
 *     beforeBulkCreate: function () {
 *       // can be a single function
 *     },
 *     beforeValidate: [
 *       function () {},
 *       function() {} // Or an array of several
 *     ]
 *   }
 * })
 *
 * // Method 2
 * Model.hook('afterDestroy', function () {})
 *
 * // Method 3
 * Model.afterBulkUpdate(function () {})
 * ```
 *
 * @see {Sequelize#define}
 * @mixin Hooks
 */
var Hooks = module.exports = function Hooks ( object, hooksPerStacks ) {
  var hooks = this;

  Object.defineProperty( object, 'hooks', {
    enumerable: false,
    writable: false,
    value: hooks,
  });

  // Create stacks
  hooksPerStacks.map(function ( hooksPerStack ) {
    var stack = new Stack({
      // Shouldn't break stack unless it is an error
      breakOn: function ( value ) {
        return false;
      }
    });

    for( var i in hooksPerStack ) {
      hooks[ hooksPerStack[i] ] = stack;
    }
  });

  // Place methods in case they aren't
  if( ! object.hookify ) {
    Utils._.extend( object, Hooks.prototype );
  }

};

/* private methods */

var shouldBeHookified = function () {
  if( ! this.hooks ) {
    throw Error("You should initialize with Hooks.ify( this )");
  }
};

var generator = function ( stage, hook ) {
  return function ( fn ) {
    return this.hook( stage + hook, fn );
  };
};

var getHooksPerStacks = function ( stages, methods ) {
  var hooksPerStacks = [];

  // For each stage and method
  stages.forEach(function ( stage ) {
    methods.forEach(function ( aliasedMethods ) {

      // methods into a string with available alias per stack
      // since a stack could be called from different hook names
      if( typeof aliasedMethods === 'string' ) {
        aliasedMethods = [ aliasedMethods ];
      }

      // If isn't an array, don't do anything
      if(!Array.isArray(aliasedMethods)) {
        throw new TypeError(
          "method should be provided as a string or an array of alias"
        );
      }

      // Generate hookNames per stack
      var hookStack = aliasedMethods.map(function ( method ) {
        return stage + method.charAt(0).toUpperCase() + method.slice(1);
      });

      hooksPerStacks.push( hookStack );
    });
  });

  return hooksPerStacks;
};

var sanitizeHooksPerStacks = function ( hooksPerStacks ) {
  if( ! Array.isArray( hooksPerStacks ) ) {
    hooksPerStacks = [];
  }

  hooksPerStacks = hooksPerStacks.map(function ( hooksPerStack ) {
    if( typeof hooksPerStack === 'string' ) {
      return [ hooksPerStack ];
    }

    return hooksPerStack;
  });

  return hooksPerStacks;
};

/* Class methods */

Hooks.ify = function ( object, hooksPerStacks ) {
  if( object.hooks ) {
    return object.hooks;
  }

  hooksPerStacks = arguments.length === 3 ?
    getHooksPerStacks( arguments[1], arguments[2] ) :
    sanitizeHooksPerStacks( hooksPerStacks );

  return new Hooks( object, hooksPerStacks );
};

Hooks.ifyPrototype = function ( Constructor, hooksPerStacks ) {

  var proto = Constructor.prototype;

  hooksPerStacks = arguments.length === 3 ?
    getHooksPerStacks( arguments[1], arguments[2] ) :
    sanitizeHooksPerStacks( hooksPerStacks );

  // Hookify instance on initialize (must be called on constructor)
  // Could be provided an object with fns per hookName
  proto.hookify = function ( options ) {
    var hooks = new Hooks( this, hooksPerStacks );

    options = options || this.options;

    if( options && options.hooks ) {
      Utils._.each( options.hooks, function ( fnOrArrayOfFns, hookName ) {
        if( hooks[ hookName ] ){
          hooks[ hookName ].queue( fnOrArrayOfFns );
        }
      });
    }

    return hooks;
  };

  // Mixin Hooks's proto into Constructor's proto
  Utils._.extend( proto, Hooks.prototype );

  hooksPerStacks.forEach(function ( hooksPerStack ) {
    hooksPerStack.forEach(function ( hookName ) {
      // Generate hookName method
      proto[ hookName ] = function ( fn ) {
        return this.addHook( hookName, fn );
      };
    });
  });

};

/* instance methods */

/**
 * Add a hook to the model
 *
 * @param {String}    hooktype
 * @param {Function}  fn        The hook function
 *
 * @alias hook
 */
Hooks.prototype.hook =
Hooks.prototype.addHook = function ( hookName, fn ) {
  shouldBeHookified.call(this);

  var stack = this.hooks[ hookName ];

  if( ! stack ) {
    throw new TypeError("Bad hook type, please check docs for right constructor hook names");
  }

  return stack.queue( fn );
};

/*
 * Check whether the mode has any hooks of this type
 *
 * @param {String}  hookType
 *
 * @alias hasHooks
 */
Hooks.prototype.hasHook =
Hooks.prototype.hasHooks = function ( hookName ) {
  shouldBeHookified.call(this);

  return this.hooks[ hookName ] && this.hooks[ hookName ].length || false;
};


Hooks.prototype.runHook = function ( hookName ) {
  shouldBeHookified.call(this);

  var stack = this.hooks[ hookName ];

  if( ! stack ) {
    throw new TypeError(
      "It seems that you didn't binded "+hookName+" hook."
    );
  }

  // Otherwise, fetch argument, remove first argument, dispatch to stack
  var args = Array.prototype.slice.call(arguments, 1);

  return stack.dispatch.apply( stack, args );
};

Hooks.prototype.runHooks = function ( hookNames ) {
  shouldBeHookified.call(this);

  var self = this;

  if(!Array.isArray( hookNames )) {
    hookNames = [ hookNames ];
  }

  var args = Array.prototype.slice.call(arguments, 1);

  return Promise.all(
    hookNames.map(function ( hookName ) {
      var stack = self.hooks[ hookName ];

      if( ! stack ) {
        throw new TypeError(
          "It seems that you didn't binded "+hookName+" hook."
        );
      }

      return stack.dispatch.apply( stack, args );
    })
  );
};
