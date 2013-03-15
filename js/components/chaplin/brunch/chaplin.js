/*!
 * Chaplin 0.7.0
 *
 * Chaplin may be freely distributed under the MIT license.
 * For all details and documentation:
 * http://chaplinjs.org
 */

// Dirty hack for require-ing backbone and underscore.
(function() {
  var deps = {
    backbone: window.Backbone, underscore: window._
  };

  for (var name in deps) {
    (function(name) {
      var definition = {};
      definition[name] = function(exports, require, module) {
        module.exports = deps[name];
      };

      try {
        require(item);
      } catch(e) {
        require.define(definition);
      }
    })(name);
  }
})();

require.define({'chaplin/application': function(exports, require, module) {
'use strict';
var Application, Backbone, Composer, Dispatcher, EventBroker, Layout, Router, mediator, _;

_ = require('underscore');

Backbone = require('backbone');

mediator = require('chaplin/mediator');

Dispatcher = require('chaplin/dispatcher');

Layout = require('chaplin/views/layout');

Composer = require('chaplin/composer');

Router = require('chaplin/lib/router');

EventBroker = require('chaplin/lib/event_broker');

module.exports = Application = (function() {

  function Application() {}

  Application.extend = Backbone.Model.extend;

  _(Application.prototype).extend(EventBroker);

  Application.prototype.title = '';

  Application.prototype.dispatcher = null;

  Application.prototype.layout = null;

  Application.prototype.router = null;

  Application.prototype.composer = null;

  Application.prototype.initialize = function() {};

  Application.prototype.initDispatcher = function(options) {
    return this.dispatcher = new Dispatcher(options);
  };

  Application.prototype.initLayout = function(options) {
    var _ref;
    if (options == null) {
      options = {};
    }
    if ((_ref = options.title) == null) {
      options.title = this.title;
    }
    return this.layout = new Layout(options);
  };

  Application.prototype.initComposer = function(options) {
    if (options == null) {
      options = {};
    }
    return this.composer = new Composer(options);
  };

  Application.prototype.initRouter = function(routes, options) {
    this.router = new Router(options);
    if (typeof routes === "function") {
      routes(this.router.match);
    }
    return this.router.startHistory();
  };

  Application.prototype.disposed = false;

  Application.prototype.dispose = function() {
    var prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    properties = ['dispatcher', 'layout', 'router', 'composer'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      if (!(this[prop] != null)) {
        continue;
      }
      this[prop].dispose();
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Application;

})();

}});;require.define({'chaplin/mediator': function(exports, require, module) {
'use strict';
var Backbone, mediator, support, utils;

Backbone = require('backbone');

support = require('chaplin/lib/support');

utils = require('chaplin/lib/utils');

mediator = {};

mediator.subscribe = Backbone.Events.on;

mediator.unsubscribe = Backbone.Events.off;

mediator.publish = Backbone.Events.trigger;

mediator._callbacks = null;

utils.readonly(mediator, 'subscribe', 'unsubscribe', 'publish');

mediator.seal = function() {
  if (support.propertyDescriptors && Object.seal) {
    return Object.seal(mediator);
  }
};

utils.readonly(mediator, 'seal');

module.exports = mediator;

}});;require.define({'chaplin/dispatcher': function(exports, require, module) {
'use strict';
var Backbone, Dispatcher, EventBroker, utils, _;

_ = require('underscore');

Backbone = require('backbone');

utils = require('chaplin/lib/utils');

EventBroker = require('chaplin/lib/event_broker');

module.exports = Dispatcher = (function() {

  Dispatcher.extend = Backbone.Model.extend;

  _(Dispatcher.prototype).extend(EventBroker);

  Dispatcher.prototype.previousControllerName = null;

  Dispatcher.prototype.currentControllerName = null;

  Dispatcher.prototype.currentController = null;

  Dispatcher.prototype.currentAction = null;

  Dispatcher.prototype.currentParams = null;

  Dispatcher.prototype.url = null;

  function Dispatcher() {
    this.initialize.apply(this, arguments);
  }

  Dispatcher.prototype.initialize = function(options) {
    if (options == null) {
      options = {};
    }
    this.settings = _(options).defaults({
      controllerPath: 'controllers/',
      controllerSuffix: '_controller'
    });
    return this.subscribeEvent('matchRoute', this.matchRouteHandler);
  };

  Dispatcher.prototype.matchRouteHandler = function(route, params, options) {
    return this.startupController(route.controller, route.action, params, options);
  };

  Dispatcher.prototype.startupController = function(controllerName, action, params, options) {
    var _this = this;
    if (action == null) {
      action = 'index';
    }
    params = params ? _.clone(params) : {};
    options = options ? _.clone(options) : {};
    if (options.changeURL !== false) {
      options.changeURL = true;
    }
    if (options.forceStartup !== true) {
      options.forceStartup = false;
    }
    if (!options.forceStartup && this.currentControllerName === controllerName && this.currentAction === action && (!this.currentParams || _(params).isEqual(this.currentParams))) {
      return;
    }
    return this.loadController(controllerName, function(ControllerConstructor) {
      return _this.controllerLoaded(controllerName, action, params, options, ControllerConstructor);
    });
  };

  Dispatcher.prototype.loadController = function(controllerName, handler) {
    var fileName, moduleName;
    fileName = utils.underscorize(controllerName) + this.settings.controllerSuffix;
    moduleName = this.settings.controllerPath + fileName;
    if (typeof define !== "undefined" && define !== null ? define.amd : void 0) {
      return require([moduleName], handler);
    } else {
      return handler(require(moduleName));
    }
  };

  Dispatcher.prototype.controllerLoaded = function(controllerName, action, params, options, ControllerConstructor) {
    var controller, methodName;
    controller = new ControllerConstructor(params, options);
    methodName = controller.beforeAction ? 'executeBeforeActions' : 'executeAction';
    return this[methodName](controller, controllerName, action, params, options);
  };

  Dispatcher.prototype.executeAction = function(controller, controllerName, action, params, options) {
    var currentController, currentControllerName;
    currentControllerName = this.currentControllerName || null;
    currentController = this.currentController || null;
    this.previousControllerName = currentControllerName;
    if (currentController) {
      this.publishEvent('beforeControllerDispose', currentController);
      currentController.dispose(params, controllerName);
    }
    options.previousControllerName = currentControllerName;
    controller[action](params, options);
    if (controller.redirected) {
      return;
    }
    this.currentControllerName = controllerName;
    this.currentController = controller;
    this.currentAction = action;
    this.currentParams = params;
    this.adjustURL(params, options);
    return this.publishEvent('startupController', {
      previousControllerName: this.previousControllerName,
      controller: this.currentController,
      controllerName: this.currentControllerName,
      params: this.currentParams,
      options: options
    });
  };

  Dispatcher.prototype.executeBeforeActions = function(controller, controllerName, action, params, options) {
    var acts, args, beforeAction, beforeActions, name, next, _i, _len, _ref,
      _this = this;
    beforeActions = [];
    args = arguments;
    _ref = utils.getAllPropertyVersions(controller, 'beforeAction');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      acts = _ref[_i];
      for (name in acts) {
        beforeAction = acts[name];
        if (name === action || RegExp("^" + name + "$").test(action)) {
          if (typeof beforeAction === 'string') {
            beforeAction = controller[beforeAction];
          }
          if (typeof beforeAction !== 'function') {
            throw new Error('Controller#executeBeforeActions: ' + ("" + beforeAction + " is not a valid beforeAction method for " + name + "."));
          }
          beforeActions.push(beforeAction);
        }
      }
    }
    next = function(method, previous) {
      if (previous == null) {
        previous = null;
      }
      if (controller.redirected) {
        return;
      }
      if (!method) {
        _this.executeAction.apply(_this, args);
        return;
      }
      previous = method.call(controller, params, options, previous);
      if (previous && typeof previous.then === 'function') {
        return previous.then(function(data) {
          if (!_this.currentController || controller === _this.currentController) {
            return next(beforeActions.shift(), data);
          }
        });
      } else {
        return next(beforeActions.shift(), previous);
      }
    };
    return next(beforeActions.shift());
  };

  Dispatcher.prototype.adjustURL = function(params, options) {
    var url;
    if (options.path == null) {
      return;
    }
    url = options.path + (options.queryString ? "?" + options.queryString : "");
    if (options.changeURL) {
      this.publishEvent('!router:changeURL', url, options);
    }
    return this.url = url;
  };

  Dispatcher.prototype.disposed = false;

  Dispatcher.prototype.dispose = function() {
    if (this.disposed) {
      return;
    }
    this.unsubscribeAllEvents();
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Dispatcher;

})();

}});;require.define({'chaplin/composer': function(exports, require, module) {
'use strict';
var Backbone, Composer, Composition, EventBroker, utils, _;

_ = require('underscore');

Backbone = require('backbone');

utils = require('chaplin/lib/utils');

Composition = require('chaplin/lib/composition');

EventBroker = require('chaplin/lib/event_broker');

module.exports = Composer = (function() {

  Composer.extend = Backbone.Model.extend;

  _(Composer.prototype).extend(EventBroker);

  Composer.prototype.compositions = null;

  function Composer() {
    this.initialize.apply(this, arguments);
  }

  Composer.prototype.initialize = function(options) {
    if (options == null) {
      options = {};
    }
    this.compositions = {};
    this.subscribeEvent('!composer:compose', this.compose);
    this.subscribeEvent('!composer:retrieve', this.retrieve);
    return this.subscribeEvent('startupController', this.cleanup);
  };

  Composer.prototype.compose = function(name, second, third) {
    if (typeof second === 'function') {
      if (third || second.prototype.dispose) {
        if (second.prototype instanceof Composition) {
          return this._compose(name, {
            composition: second,
            options: third
          });
        } else {
          return this._compose(name, {
            options: third,
            compose: function() {
              var autoRender, disabledAutoRender;
              this.item = new second(this.options);
              autoRender = this.item.autoRender;
              disabledAutoRender = autoRender === void 0 || !autoRender;
              if (disabledAutoRender && typeof this.item.render === 'function') {
                return this.item.render();
              }
            }
          });
        }
      }
      return this._compose(name, {
        compose: second
      });
    }
    if (typeof third === 'function') {
      return this._compose(name, {
        compose: third,
        options: second
      });
    }
    return this._compose(name, second);
  };

  Composer.prototype._compose = function(name, options) {
    var composition, current;
    if (typeof options.compose !== 'function' && (options.composition == null)) {
      throw new Error('Composer#compose was used incorrectly');
    }
    if (options.composition != null) {
      composition = new options.composition(options.options);
    } else {
      composition = new Composition(options.options);
      composition.compose = options.compose;
      if (options.check) {
        composition.check = options.check;
      }
    }
    current = this.compositions[name];
    if (current && current.check(composition.options)) {
      current.stale(false);
    } else {
      if (current) {
        current.dispose();
      }
      composition.compose(composition.options);
      composition.stale(false);
      this.compositions[name] = composition;
    }
    return this.compositions[name];
  };

  Composer.prototype.retrieve = function(name, callback) {
    var active, item;
    active = this.compositions[name];
    item = (active && !active.stale() ? active.item : void 0);
    return callback(item);
  };

  Composer.prototype.cleanup = function() {
    var composition, name, _ref;
    _ref = this.compositions;
    for (name in _ref) {
      composition = _ref[name];
      if (composition.stale()) {
        composition.dispose();
        delete this.compositions[name];
      } else {
        composition.stale(true);
      }
    }
  };

  Composer.prototype.dispose = function() {
    var composition, name, _ref;
    if (this.disposed) {
      return;
    }
    this.unsubscribeAllEvents();
    _ref = this.compositions;
    for (name in _ref) {
      composition = _ref[name];
      composition.dispose();
    }
    delete this.compositions;
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Composer;

})();

}});;require.define({'chaplin/controllers/controller': function(exports, require, module) {
'use strict';
var Backbone, Controller, EventBroker, _,
  __hasProp = {}.hasOwnProperty;

_ = require('underscore');

Backbone = require('backbone');

EventBroker = require('chaplin/lib/event_broker');

module.exports = Controller = (function() {

  Controller.extend = Backbone.Model.extend;

  _(Controller.prototype).extend(Backbone.Events);

  _(Controller.prototype).extend(EventBroker);

  Controller.prototype.view = null;

  Controller.prototype.redirected = false;

  function Controller() {
    this.initialize.apply(this, arguments);
  }

  Controller.prototype.initialize = function() {};

  Controller.prototype.adjustTitle = function(subtitle) {
    return this.publishEvent('!adjustTitle', subtitle);
  };

  Controller.prototype.compose = function(name, second, third) {
    var item;
    if (arguments.length === 1) {
      item = null;
      this.publishEvent('!composer:retrieve', name, function(composition) {
        return item = composition;
      });
      return item;
    } else {
      return this.publishEvent('!composer:compose', name, second, third);
    }
  };

  Controller.prototype.redirectTo = function(url, options) {
    if (options == null) {
      options = {};
    }
    this.redirected = true;
    return this.publishEvent('!router:route', url, options, function(routed) {
      if (!routed) {
        throw new Error('Controller#redirectTo: no route matched');
      }
    });
  };

  Controller.prototype.redirectToRoute = function(name, params, options) {
    this.redirected = true;
    return this.publishEvent('!router:routeByName', name, params, options, function(routed) {
      if (!routed) {
        throw new Error('Controller#redirectToRoute: no route matched');
      }
    });
  };

  Controller.prototype.disposed = false;

  Controller.prototype.dispose = function() {
    var obj, prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    for (prop in this) {
      if (!__hasProp.call(this, prop)) continue;
      obj = this[prop];
      if (!(obj && typeof obj.dispose === 'function')) {
        continue;
      }
      obj.dispose();
      delete this[prop];
    }
    this.unsubscribeAllEvents();
    this.stopListening();
    properties = ['redirected'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Controller;

})();

}});;require.define({'chaplin/models/collection': function(exports, require, module) {
'use strict';
var Backbone, Collection, EventBroker, Model, utils, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

Backbone = require('backbone');

EventBroker = require('chaplin/lib/event_broker');

Model = require('chaplin/models/model');

utils = require('chaplin/lib/utils');

module.exports = Collection = (function(_super) {

  __extends(Collection, _super);

  function Collection() {
    Collection.__super__.constructor.apply(this, arguments);
  }

  _(Collection.prototype).extend(EventBroker);

  Collection.prototype.model = Model;

  Collection.prototype.initDeferred = function() {
    return _(this).extend($.Deferred());
  };

  Collection.prototype.serialize = function() {
    return this.map(utils.serialize);
  };

  Collection.prototype.disposed = false;

  Collection.prototype.dispose = function() {
    var prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    this.trigger('dispose', this);
    this.reset([], {
      silent: true
    });
    this.unsubscribeAllEvents();
    this.stopListening();
    this.off();
    if (typeof this.reject === "function") {
      this.reject();
    }
    properties = ['model', 'models', '_byId', '_byCid', '_callbacks'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Collection;

})(Backbone.Collection);

}});;require.define({'chaplin/models/model': function(exports, require, module) {
'use strict';
var Backbone, EventBroker, Model, serializeAttributes, serializeModelAttributes, utils, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

Backbone = require('backbone');

utils = require('chaplin/lib/utils');

EventBroker = require('chaplin/lib/event_broker');

serializeAttributes = function(model, attributes, modelStack) {
  var delegator, key, otherModel, serializedModels, value, _i, _len, _ref;
  delegator = utils.beget(attributes);
  if (modelStack == null) {
    modelStack = {};
  }
  modelStack[model.cid] = true;
  for (key in attributes) {
    value = attributes[key];
    if (value instanceof Backbone.Model) {
      delegator[key] = serializeModelAttributes(value, model, modelStack);
    } else if (value instanceof Backbone.Collection) {
      serializedModels = [];
      _ref = value.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        otherModel = _ref[_i];
        serializedModels.push(serializeModelAttributes(otherModel, model, modelStack));
      }
      delegator[key] = serializedModels;
    }
  }
  delete modelStack[model.cid];
  return delegator;
};

serializeModelAttributes = function(model, currentModel, modelStack) {
  var attributes;
  if (model === currentModel || _(modelStack).has(model.cid)) {
    return null;
  }
  attributes = typeof model.getAttributes === 'function' ? model.getAttributes() : model.attributes;
  return serializeAttributes(model, attributes, modelStack);
};

module.exports = Model = (function(_super) {

  __extends(Model, _super);

  function Model() {
    Model.__super__.constructor.apply(this, arguments);
  }

  _(Model.prototype).extend(EventBroker);

  Model.prototype.initDeferred = function() {
    return _(this).extend($.Deferred());
  };

  Model.prototype.getAttributes = function() {
    return this.attributes;
  };

  Model.prototype.serialize = function() {
    return serializeAttributes(this, this.getAttributes());
  };

  Model.prototype.disposed = false;

  Model.prototype.dispose = function() {
    var prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    this.trigger('dispose', this);
    this.unsubscribeAllEvents();
    this.stopListening();
    this.off();
    if (typeof this.reject === "function") {
      this.reject();
    }
    properties = ['collection', 'attributes', 'changed', '_escapedAttributes', '_previousAttributes', '_silent', '_pending', '_callbacks'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Model;

})(Backbone.Model);

}});;require.define({'chaplin/views/layout': function(exports, require, module) {
'use strict';
var $, Backbone, EventBroker, Layout, utils, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('underscore');

Backbone = require('backbone');

utils = require('chaplin/lib/utils');

EventBroker = require('chaplin/lib/event_broker');

$ = Backbone.$;

module.exports = Layout = (function() {

  Layout.extend = Backbone.Model.extend;

  _(Layout.prototype).extend(EventBroker);

  Layout.prototype.title = '';

  Layout.prototype.events = {};

  Layout.prototype.el = document;

  Layout.prototype.$el = $(document);

  Layout.prototype.cid = 'chaplin-layout';

  Layout.prototype.regions = null;

  function Layout() {
    this.openLink = __bind(this.openLink, this);    this.initialize.apply(this, arguments);
  }

  Layout.prototype.initialize = function(options) {
    if (options == null) {
      options = {};
    }
    this.title = options.title;
    this.settings = _(options).defaults({
      titleTemplate: _.template("<%= subtitle %> \u2013 <%= title %>"),
      openExternalToBlank: false,
      routeLinks: 'a, .go-to',
      skipRouting: '.noscript',
      scrollTo: [0, 0]
    });
    this.regions = [];
    this.subscribeEvent('beforeControllerDispose', this.hideOldView);
    this.subscribeEvent('startupController', this.showNewView);
    this.subscribeEvent('!adjustTitle', this.adjustTitle);
    this.subscribeEvent('!region:show', this.showRegion);
    this.subscribeEvent('!region:register', this.registerRegionHandler);
    this.subscribeEvent('!region:unregister', this.unregisterRegionHandler);
    if (this.settings.routeLinks) {
      this.startLinkRouting();
    }
    return this.delegateEvents();
  };

  Layout.prototype.delegateEvents = Backbone.View.prototype.delegateEvents;

  Layout.prototype.undelegateEvents = Backbone.View.prototype.undelegateEvents;

  Layout.prototype.hideOldView = function(controller) {
    var scrollTo, view;
    scrollTo = this.settings.scrollTo;
    if (scrollTo) {
      window.scrollTo(scrollTo[0], scrollTo[1]);
    }
    view = controller.view;
    if (view) {
      return view.$el.hide();
    }
  };

  Layout.prototype.showNewView = function(context) {
    var view;
    view = context.controller.view;
    if (view) {
      return view.$el.show();
    }
  };

  Layout.prototype.adjustTitle = function(subtitle) {
    var title;
    if (subtitle == null) {
      subtitle = '';
    }
    title = this.settings.titleTemplate({
      title: this.title,
      subtitle: subtitle
    });
    return setTimeout((function() {
      return document.title = title;
    }), 50);
  };

  Layout.prototype.startLinkRouting = function() {
    if (this.settings.routeLinks) {
      return $(document).on('click', this.settings.routeLinks, this.openLink);
    }
  };

  Layout.prototype.stopLinkRouting = function() {
    if (this.settings.routeLinks) {
      return $(document).off('click', this.settings.routeLinks);
    }
  };

  Layout.prototype.openLink = function(event) {
    var $el, callback, el, href, internal, isAnchor, options, path, queryString, skipRouting, type, _ref, _ref1, _ref2;
    if (utils.modifierKeyPressed(event)) {
      return;
    }
    el = event.currentTarget;
    $el = $(el);
    isAnchor = el.nodeName === 'A';
    href = $el.attr('href') || $el.data('href') || null;
    if (href === null || href === void 0 || href === '' || href.charAt(0) === '#') {
      return;
    }
    if (isAnchor && ($el.attr('target') === '_blank' || $el.attr('rel') === 'external' || ((_ref = el.protocol) !== 'http:' && _ref !== 'https:' && _ref !== 'file:'))) {
      return;
    }
    skipRouting = this.settings.skipRouting;
    type = typeof skipRouting;
    if (type === 'function' && !skipRouting(href, el) || type === 'string' && $el.is(skipRouting)) {
      return;
    }
    internal = !isAnchor || ((_ref1 = el.hostname) === location.hostname || _ref1 === '');
    if (!internal) {
      if (this.settings.openExternalToBlank) {
        event.preventDefault();
        window.open(el.href);
      }
      return;
    }
    if (isAnchor) {
      path = el.pathname;
      queryString = el.search.substring(1);
      if (path.charAt(0) !== '/') {
        path = "/" + path;
      }
    } else {
      _ref2 = href.split('?'), path = _ref2[0], queryString = _ref2[1];
      if (queryString == null) {
        queryString = '';
      }
    }
    options = {
      queryString: queryString
    };
    callback = function(routed) {
      if (routed) {
        event.preventDefault();
      } else if (!isAnchor) {
        location.href = path;
      }
    };
    this.publishEvent('!router:route', path, options, callback);
  };

  Layout.prototype.registerRegionHandler = function(instance, name, selector) {
    if (name != null) {
      return this.registerRegion(instance, name, selector);
    } else {
      return this.registerRegions(instance);
    }
  };

  Layout.prototype.registerRegion = function(instance, name, selector) {
    this.unregisterRegion(instance, name);
    return this.regions.unshift({
      instance: instance,
      name: name,
      selector: selector
    });
  };

  Layout.prototype.registerRegions = function(instance) {
    var name, selector, version, _i, _len, _ref;
    _ref = utils.getAllPropertyVersions(instance, 'regions');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      version = _ref[_i];
      for (selector in version) {
        name = version[selector];
        this.registerRegion(instance, name, selector);
      }
    }
  };

  Layout.prototype.unregisterRegionHandler = function(instance, name) {
    if (name != null) {
      return this.unregisterRegion(instance, name);
    } else {
      return this.unregisterRegions(instance);
    }
  };

  Layout.prototype.unregisterRegion = function(instance, name) {
    var cid;
    cid = instance.cid;
    return this.regions = _(this.regions).filter(function(region) {
      return region.instance.cid !== cid || region.name !== name;
    });
  };

  Layout.prototype.unregisterRegions = function(instance) {
    return this.regions = _(this.regions).filter(function(region) {
      return region.instance.cid !== instance.cid;
    });
  };

  Layout.prototype.showRegion = function(name, instance) {
    var region;
    region = _.find(this.regions, function(region) {
      return region.name === name && !region.instance.stale;
    });
    if (!region) {
      throw new Error("No region registered under " + name);
    }
    return instance.container = region.instance.$el.find(region.selector);
  };

  Layout.prototype.disposed = false;

  Layout.prototype.dispose = function() {
    if (this.disposed) {
      return;
    }
    delete this.regions;
    this.stopLinkRouting();
    this.unsubscribeAllEvents();
    this.undelegateEvents();
    delete this.title;
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Layout;

})();

}});;require.define({'chaplin/views/view': function(exports, require, module) {
'use strict';
var $, Backbone, EventBroker, View, utils, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

Backbone = require('backbone');

utils = require('chaplin/lib/utils');

EventBroker = require('chaplin/lib/event_broker');

$ = Backbone.$;

module.exports = View = (function(_super) {

  __extends(View, _super);

  _(View.prototype).extend(EventBroker);

  View.prototype.autoRender = false;

  View.prototype.autoAttach = true;

  View.prototype.container = null;

  View.prototype.containerMethod = 'append';

  View.prototype.regions = null;

  View.prototype.region = null;

  View.prototype.subviews = null;

  View.prototype.subviewsByName = null;

  View.prototype.stale = false;

  function View(options) {
    var render,
      _this = this;
    if (options) {
      _(this).extend(_.pick(options, ['autoAttach', 'autoRender', 'container', 'containerMethod', 'region']));
    }
    if (this.render === View.prototype.render) {
      this.render = _(this.render).bind(this);
    } else {
      render = this.render;
      this.renderIsWrapped = true;
      this.render = function() {
        if (_this.disposed) {
          return false;
        }
        render.apply(_this, arguments);
        if (_this.autoAttach) {
          _this.attach.apply(_this, arguments);
        }
        return _this;
      };
    }
    this.subviews = [];
    this.subviewsByName = {};
    View.__super__.constructor.apply(this, arguments);
    this.delegateListeners();
    if (this.model) {
      this.listenTo(this.model, 'dispose', this.dispose);
    }
    if (this.collection) {
      this.listenTo(this.collection, 'dispose', this.dispose);
    }
    if (this.regions != null) {
      this.publishEvent('!region:register', this);
    }
    if (this.autoRender) {
      this.render();
    }
  }

  View.prototype.delegate = function(eventName, second, third) {
    var bound, events, handler, list, selector,
      _this = this;
    if (typeof eventName !== 'string') {
      throw new TypeError('View#delegate: first argument must be a string');
    }
    if (arguments.length === 2) {
      handler = second;
    } else if (arguments.length === 3) {
      selector = second;
      if (typeof selector !== 'string') {
        throw new TypeError('View#delegate: ' + 'second argument must be a string');
      }
      handler = third;
    } else {
      throw new TypeError('View#delegate: ' + 'only two or three arguments are allowed');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('View#delegate: ' + 'handler argument must be function');
    }
    list = _.map(eventName.split(' '), function(event) {
      return "" + event + ".delegate" + _this.cid;
    });
    events = list.join(' ');
    bound = _.bind(handler, this);
    this.$el.on(events, selector || null, bound);
    return bound;
  };

  View.prototype._delegateEvents = function(events) {
    var bound, eventName, handler, key, match, selector, value;
    for (key in events) {
      value = events[key];
      handler = typeof value === 'function' ? value : this[value];
      if (!handler) {
        throw new Error("Method '" + handler + "' does not exist");
      }
      match = key.match(/^(\S+)\s*(.*)$/);
      eventName = "" + match[1] + ".delegateEvents" + this.cid;
      selector = match[2];
      bound = _.bind(handler, this);
      this.$el.on(eventName, selector || null, bound);
    }
  };

  View.prototype.delegateEvents = function(events) {
    var classEvents, _i, _len, _ref;
    this.undelegateEvents();
    if (events) {
      this._delegateEvents(events);
      return;
    }
    _ref = utils.getAllPropertyVersions(this, 'events');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      classEvents = _ref[_i];
      if (typeof classEvents === 'function') {
        throw new TypeError('View#delegateEvents: functions are not supported');
      }
      this._delegateEvents(classEvents);
    }
  };

  View.prototype.undelegate = function() {
    return this.$el.unbind(".delegate" + this.cid);
  };

  View.prototype.delegateListeners = function() {
    var eventName, key, method, target, version, _i, _len, _ref, _ref1;
    if (!this.listen) {
      return;
    }
    _ref = utils.getAllPropertyVersions(this, 'listen');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      version = _ref[_i];
      for (key in version) {
        method = version[key];
        if (typeof method !== 'function') {
          method = this[method];
        }
        if (typeof method !== 'function') {
          throw new Error('View#delegateListeners: ' + ("" + method + " must be function"));
        }
        _ref1 = key.split(' '), eventName = _ref1[0], target = _ref1[1];
        this.delegateListener(eventName, target, method);
      }
    }
  };

  View.prototype.delegateListener = function(eventName, target, callback) {
    var prop;
    if (target === 'model' || target === 'collection') {
      prop = this[target];
      if (prop) {
        this.listenTo(prop, eventName, callback);
      }
    } else if (target === 'mediator') {
      this.subscribeEvent(eventName, callback);
    } else if (!target) {
      this.on(eventName, callback, this);
    }
  };

  View.prototype.registerRegion = function(selector, name) {
    return this.publishEvent('!region:register', this, name, selector);
  };

  View.prototype.unregisterRegion = function(name) {
    return this.publishEvent('!region:unregister', this, name);
  };

  View.prototype.unregisterAllRegions = function() {
    return this.publishEvent('!region:unregister', this);
  };

  View.prototype.subview = function(name, view) {
    if (name && view) {
      this.removeSubview(name);
      this.subviews.push(view);
      this.subviewsByName[name] = view;
      return view;
    } else if (name) {
      return this.subviewsByName[name];
    }
  };

  View.prototype.removeSubview = function(nameOrView) {
    var index, name, otherName, otherView, view, _ref;
    if (!nameOrView) {
      return;
    }
    if (typeof nameOrView === 'string') {
      name = nameOrView;
      view = this.subviewsByName[name];
    } else {
      view = nameOrView;
      _ref = this.subviewsByName;
      for (otherName in _ref) {
        otherView = _ref[otherName];
        if (view === otherView) {
          name = otherName;
          break;
        }
      }
    }
    if (!(name && view && view.dispose)) {
      return;
    }
    view.dispose();
    index = _(this.subviews).indexOf(view);
    if (index > -1) {
      this.subviews.splice(index, 1);
    }
    return delete this.subviewsByName[name];
  };

  View.prototype.getTemplateData = function() {
    var data, source;
    data = this.model ? utils.serialize(this.model) : this.collection ? {
      items: utils.serialize(this.collection),
      length: this.collection.length
    } : {};
    source = this.model || this.collection;
    if (source) {
      if (typeof source.state === 'function' && !('resolved' in data)) {
        data.resolved = source.state() === 'resolved';
      }
      if (typeof source.isSynced === 'function' && !('synced' in data)) {
        data.synced = source.isSynced();
      }
    }
    return data;
  };

  View.prototype.getTemplateFunction = function() {
    throw new Error('View#getTemplateFunction must be overridden');
  };

  View.prototype.render = function() {
    var html, templateFunc;
    if (this.disposed) {
      return false;
    }
    templateFunc = this.getTemplateFunction();
    if (typeof templateFunc === 'function') {
      html = templateFunc(this.getTemplateData());
      this.$el.html(html);
    }
    if (!this.renderIsWrapped) {
      this.attach();
    }
    return this;
  };

  View.prototype.attach = function() {
    if (this.region != null) {
      this.publishEvent('!region:show', this.region, this);
    }
    if (this.container) {
      $(this.container)[this.containerMethod](this.el);
      return this.trigger('addedToDOM');
    }
  };

  View.prototype.disposed = false;

  View.prototype.dispose = function() {
    var prop, properties, subview, _i, _j, _len, _len1, _ref;
    if (this.disposed) {
      return;
    }
    if (this.subviews == null) {
      throw new Error('Your `initialize` method must include a super call to\
      Chaplin `initialize`');
    }
    this.unregisterAllRegions();
    _ref = this.subviews;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      subview = _ref[_i];
      subview.dispose();
    }
    this.unsubscribeAllEvents();
    this.stopListening();
    this.off();
    this.$el.remove();
    properties = ['el', '$el', 'options', 'model', 'collection', 'subviews', 'subviewsByName', '_callbacks'];
    for (_j = 0, _len1 = properties.length; _j < _len1; _j++) {
      prop = properties[_j];
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return View;

})(Backbone.View);

}});;require.define({'chaplin/views/collection_view': function(exports, require, module) {
'use strict';
var $, Backbone, CollectionView, View, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

_ = require('underscore');

Backbone = require('backbone');

View = require('chaplin/views/view');

$ = Backbone.$;

module.exports = CollectionView = (function(_super) {

  __extends(CollectionView, _super);

  CollectionView.prototype.itemView = null;

  CollectionView.prototype.autoRender = true;

  CollectionView.prototype.renderItems = true;

  CollectionView.prototype.animationDuration = 500;

  CollectionView.prototype.useCssAnimation = false;

  CollectionView.prototype.animationStartClass = 'animated-item-view';

  CollectionView.prototype.animationEndClass = 'animated-item-view-end';

  CollectionView.prototype.listSelector = null;

  CollectionView.prototype.$list = null;

  CollectionView.prototype.fallbackSelector = null;

  CollectionView.prototype.$fallback = null;

  CollectionView.prototype.loadingSelector = null;

  CollectionView.prototype.$loading = null;

  CollectionView.prototype.itemSelector = null;

  CollectionView.prototype.filterer = null;

  CollectionView.prototype.filterCallback = function(view, included) {
    return view.$el.stop(true, true).toggle(included);
  };

  CollectionView.prototype.visibleItems = null;

  function CollectionView(options) {
    this.renderAllItems = __bind(this.renderAllItems, this);
    this.toggleFallback = __bind(this.toggleFallback, this);
    this.itemsReset = __bind(this.itemsReset, this);
    this.itemRemoved = __bind(this.itemRemoved, this);
    this.itemAdded = __bind(this.itemAdded, this);    if (options) {
      _(this).extend(_.pick(options, ['renderItems', 'itemView']));
    }
    this.visibleItems = [];
    CollectionView.__super__.constructor.apply(this, arguments);
  }

  CollectionView.prototype.initialize = function(options) {
    if (options == null) {
      options = {};
    }
    this.addCollectionListeners();
    if (options.filterer != null) {
      return this.filter(options.filterer);
    }
  };

  CollectionView.prototype.addCollectionListeners = function() {
    this.listenTo(this.collection, 'add', this.itemAdded);
    this.listenTo(this.collection, 'remove', this.itemRemoved);
    return this.listenTo(this.collection, 'reset sort', this.itemsReset);
  };

  CollectionView.prototype.getTemplateData = function() {
    var templateData;
    templateData = {
      length: this.collection.length
    };
    if (typeof this.collection.state === 'function') {
      templateData.resolved = this.collection.state() === 'resolved';
    }
    if (typeof this.collection.isSynced === 'function') {
      templateData.synced = this.collection.isSynced();
    }
    return templateData;
  };

  CollectionView.prototype.getTemplateFunction = function() {};

  CollectionView.prototype.render = function() {
    CollectionView.__super__.render.apply(this, arguments);
    this.$list = this.listSelector ? this.$(this.listSelector) : this.$el;
    this.initFallback();
    this.initLoadingIndicator();
    if (this.renderItems) {
      return this.renderAllItems();
    }
  };

  CollectionView.prototype.itemAdded = function(item, collection, options) {
    if (options == null) {
      options = {};
    }
    return this.insertView(item, this.renderItem(item), options.index);
  };

  CollectionView.prototype.itemRemoved = function(item) {
    return this.removeViewForItem(item);
  };

  CollectionView.prototype.itemsReset = function() {
    return this.renderAllItems();
  };

  CollectionView.prototype.initFallback = function() {
    if (!this.fallbackSelector) {
      return;
    }
    this.$fallback = this.$(this.fallbackSelector);
    this.on('visibilityChange', this.toggleFallback);
    this.listenTo(this.collection, 'syncStateChange', this.toggleFallback);
    return this.toggleFallback();
  };

  CollectionView.prototype.toggleFallback = function() {
    var visible;
    visible = this.visibleItems.length === 0 && (typeof this.collection.isSynced === 'function' ? this.collection.isSynced() : true);
    return this.$fallback.toggle(visible);
  };

  CollectionView.prototype.initLoadingIndicator = function() {
    if (!(this.loadingSelector && typeof this.collection.isSyncing === 'function')) {
      return;
    }
    this.$loading = this.$(this.loadingSelector);
    this.listenTo(this.collection, 'syncStateChange', this.toggleLoadingIndicator);
    return this.toggleLoadingIndicator();
  };

  CollectionView.prototype.toggleLoadingIndicator = function() {
    var visible;
    visible = this.collection.length === 0 && this.collection.isSyncing();
    return this.$loading.toggle(visible);
  };

  CollectionView.prototype.getItemViews = function() {
    var itemViews, name, view, _ref;
    itemViews = {};
    _ref = this.subviewsByName;
    for (name in _ref) {
      view = _ref[name];
      if (name.slice(0, 9) === 'itemView:') {
        itemViews[name.slice(9)] = view;
      }
    }
    return itemViews;
  };

  CollectionView.prototype.filter = function(filterer, filterCallback) {
    var included, index, item, view, _i, _len, _ref;
    this.filterer = filterer;
    if (filterCallback) {
      this.filterCallback = filterCallback;
    }
    if (filterCallback == null) {
      filterCallback = this.filterCallback;
    }
    if (!_(this.getItemViews()).isEmpty()) {
      _ref = this.collection.models;
      for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
        item = _ref[index];
        included = typeof filterer === 'function' ? filterer(item, index) : true;
        view = this.subview("itemView:" + item.cid);
        if (!view) {
          throw new Error('CollectionView#filter: ' + ("no view found for " + item.cid));
        }
        this.filterCallback(view, included);
        this.updateVisibleItems(view.model, included, false);
      }
    }
    return this.trigger('visibilityChange', this.visibleItems);
  };

  CollectionView.prototype.renderAllItems = function() {
    var cid, index, item, items, remainingViewsByCid, view, _i, _j, _len, _len1, _ref;
    items = this.collection.models;
    this.visibleItems = [];
    remainingViewsByCid = {};
    for (_i = 0, _len = items.length; _i < _len; _i++) {
      item = items[_i];
      view = this.subview("itemView:" + item.cid);
      if (view) {
        remainingViewsByCid[item.cid] = view;
      }
    }
    _ref = this.getItemViews();
    for (cid in _ref) {
      if (!__hasProp.call(_ref, cid)) continue;
      view = _ref[cid];
      if (!(cid in remainingViewsByCid)) {
        this.removeSubview("itemView:" + cid);
      }
    }
    for (index = _j = 0, _len1 = items.length; _j < _len1; index = ++_j) {
      item = items[index];
      view = this.subview("itemView:" + item.cid);
      if (view) {
        this.insertView(item, view, index, false);
      } else {
        this.insertView(item, this.renderItem(item), index);
      }
    }
    if (items.length === 0) {
      return this.trigger('visibilityChange', this.visibleItems);
    }
  };

  CollectionView.prototype.renderItem = function(item) {
    var view;
    view = this.subview("itemView:" + item.cid);
    if (!view) {
      view = this.initItemView(item);
      this.subview("itemView:" + item.cid, view);
    }
    view.render();
    return view;
  };

  CollectionView.prototype.initItemView = function(model) {
    if (this.itemView) {
      return new this.itemView({
        model: model,
        autoRender: false
      });
    } else {
      throw new Error('The CollectionView#itemView property ' + 'must be defined or the initItemView() must be overridden.');
    }
  };

  CollectionView.prototype.insertView = function(item, view, index, enableAnimation) {
    var $list, $next, $previous, $viewEl, children, included, length, position, viewEl,
      _this = this;
    if (index == null) {
      index = null;
    }
    if (enableAnimation == null) {
      enableAnimation = true;
    }
    if (this.animationDuration === 0) {
      enableAnimation = false;
    }
    position = typeof index === 'number' ? index : this.collection.indexOf(item);
    included = typeof this.filterer === 'function' ? this.filterer(item, position) : true;
    viewEl = view.el;
    $viewEl = view.$el;
    if (included && enableAnimation) {
      if (this.useCssAnimation) {
        $viewEl.addClass(this.animationStartClass);
      } else {
        $viewEl.css('opacity', 0);
      }
    }
    if (this.filterer) {
      this.filterCallback(view, included);
    }
    $list = this.$list;
    children = this.itemSelector ? $list.children(this.itemSelector) : $list.children();
    if (children.get(position) !== viewEl) {
      length = children.length;
      if (length === 0 || position === length) {
        $list.append(viewEl);
      } else {
        if (position === 0) {
          $next = children.eq(position);
          $next.before(viewEl);
        } else {
          $previous = children.eq(position - 1);
          $previous.after(viewEl);
        }
      }
    }
    view.trigger('addedToParent');
    this.updateVisibleItems(item, included);
    if (included && enableAnimation) {
      if (this.useCssAnimation) {
        setTimeout(function() {
          return $viewEl.addClass(_this.animationEndClass);
        }, 0);
      } else {
        $viewEl.animate({
          opacity: 1
        }, this.animationDuration);
      }
    }
  };

  CollectionView.prototype.removeViewForItem = function(item) {
    this.updateVisibleItems(item, false);
    return this.removeSubview("itemView:" + item.cid);
  };

  CollectionView.prototype.updateVisibleItems = function(item, includedInFilter, triggerEvent) {
    var includedInVisibleItems, visibilityChanged, visibleItemsIndex;
    if (triggerEvent == null) {
      triggerEvent = true;
    }
    visibilityChanged = false;
    visibleItemsIndex = _(this.visibleItems).indexOf(item);
    includedInVisibleItems = visibleItemsIndex > -1;
    if (includedInFilter && !includedInVisibleItems) {
      this.visibleItems.push(item);
      visibilityChanged = true;
    } else if (!includedInFilter && includedInVisibleItems) {
      this.visibleItems.splice(visibleItemsIndex, 1);
      visibilityChanged = true;
    }
    if (visibilityChanged && triggerEvent) {
      this.trigger('visibilityChange', this.visibleItems);
    }
    return visibilityChanged;
  };

  CollectionView.prototype.dispose = function() {
    var prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    properties = ['$list', '$fallback', '$loading', 'visibleItems'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      delete this[prop];
    }
    return CollectionView.__super__.dispose.apply(this, arguments);
  };

  return CollectionView;

})(View);

}});;require.define({'chaplin/lib/route': function(exports, require, module) {
'use strict';
var Backbone, Controller, EventBroker, Route, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __hasProp = {}.hasOwnProperty;

_ = require('underscore');

Backbone = require('backbone');

EventBroker = require('chaplin/lib/event_broker');

Controller = require('chaplin/controllers/controller');

module.exports = Route = (function() {
  var escapeRegExp, queryStringFieldSeparator, queryStringValueSeparator;

  Route.extend = Backbone.Model.extend;

  _(Route.prototype).extend(EventBroker);

  escapeRegExp = /[-[\]{}()+?.,\\^$|#\s]/g;

  queryStringFieldSeparator = '&';

  queryStringValueSeparator = '=';

  function Route(pattern, controller, action, options) {
    this.pattern = pattern;
    this.controller = controller;
    this.action = action;
    this.handler = __bind(this.handler, this);
    this.addParamName = __bind(this.addParamName, this);
    this.options = options ? _.clone(options) : {};
    if (this.options.name != null) {
      this.name = this.options.name;
    }
    this.paramNames = [];
    if (_(Controller.prototype).has(this.action)) {
      throw new Error('Route: You should not use existing controller ' + 'properties as action names');
    }
    this.createRegExp();
  }

  Route.prototype.reverse = function(params) {
    var index, name, notEnoughParams, url, value, _i, _len, _ref;
    url = this.pattern;
    if (_.isRegExp(url)) {
      return false;
    }
    notEnoughParams = 'Route#reverse: Not enough parameters to reverse';
    if (_.isArray(params)) {
      if (params.length < this.paramNames.length) {
        throw new Error(notEnoughParams);
      }
      index = 0;
      url = url.replace(/[:*][^\/\?]+/g, function(match) {
        var result;
        result = params[index];
        index += 1;
        return result;
      });
    } else {
      _ref = this.paramNames;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        name = _ref[_i];
        value = params[name];
        if (value === void 0) {
          throw new Error(notEnoughParams);
        }
        url = url.replace(RegExp("[:*]" + name, "g"), value);
      }
    }
    if (this.test(url)) {
      return url;
    } else {
      return false;
    }
  };

  Route.prototype.createRegExp = function() {
    var pattern;
    if (_.isRegExp(this.pattern)) {
      this.regExp = this.pattern;
      if (_.isArray(this.options.names)) {
        this.paramNames = this.options.names;
      }
      return;
    }
    pattern = this.pattern.replace(escapeRegExp, '\\$&').replace(/(?::|\*)(\w+)/g, this.addParamName);
    return this.regExp = RegExp("^" + pattern + "(?=\\?|$)");
  };

  Route.prototype.addParamName = function(match, paramName) {
    this.paramNames.push(paramName);
    if (match.charAt(0) === ':') {
      return '([^\/\?]+)';
    } else {
      return '(.*?)';
    }
  };

  Route.prototype.test = function(path) {
    var constraint, constraints, matched, name, params;
    matched = this.regExp.test(path);
    if (!matched) {
      return false;
    }
    constraints = this.options.constraints;
    if (constraints) {
      params = this.extractParams(path);
      for (name in constraints) {
        if (!__hasProp.call(constraints, name)) continue;
        constraint = constraints[name];
        if (!constraint.test(params[name])) {
          return false;
        }
      }
    }
    return true;
  };

  Route.prototype.handler = function(path, options) {
    var params, queryString, _ref;
    options = options ? _.clone(options) : {};
    queryString = (_ref = options.queryString) != null ? _ref : this.getCurrentQueryString();
    params = this.buildParams(path, queryString);
    options.path = path;
    return this.publishEvent('matchRoute', this, params, options);
  };

  Route.prototype.getCurrentQueryString = function() {
    return location.search.substring(1);
  };

  Route.prototype.buildParams = function(path, queryString) {
    return _.extend({}, this.extractQueryParams(queryString), this.extractParams(path), this.options.params);
  };

  Route.prototype.extractParams = function(path) {
    var index, match, matches, paramName, params, _i, _len, _ref;
    params = {};
    matches = this.regExp.exec(path);
    _ref = matches.slice(1);
    for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
      match = _ref[index];
      paramName = this.paramNames.length ? this.paramNames[index] : index;
      params[paramName] = match;
    }
    return params;
  };

  Route.prototype.extractQueryParams = function(queryString) {
    var current, field, pair, pairs, params, value, _i, _len, _ref;
    params = {};
    if (!queryString) {
      return params;
    }
    pairs = queryString.split(queryStringFieldSeparator);
    for (_i = 0, _len = pairs.length; _i < _len; _i++) {
      pair = pairs[_i];
      if (!pair.length) {
        continue;
      }
      _ref = pair.split(queryStringValueSeparator), field = _ref[0], value = _ref[1];
      if (!field.length) {
        continue;
      }
      field = decodeURIComponent(field);
      value = decodeURIComponent(value);
      current = params[field];
      if (current) {
        if (current.push) {
          current.push(value);
        } else {
          params[field] = [current, value];
        }
      } else {
        params[field] = value;
      }
    }
    return params;
  };

  return Route;

})();

}});;require.define({'chaplin/lib/router': function(exports, require, module) {
'use strict';
var Backbone, EventBroker, Route, Router, utils, _,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

_ = require('underscore');

Backbone = require('backbone');

EventBroker = require('chaplin/lib/event_broker');

Route = require('chaplin/lib/route');

utils = require('chaplin/lib/utils');

module.exports = Router = (function() {

  Router.extend = Backbone.Model.extend;

  _(Router.prototype).extend(EventBroker);

  function Router(options) {
    this.options = options != null ? options : {};
    this.route = __bind(this.route, this);
    this.match = __bind(this.match, this);
    _(this.options).defaults({
      pushState: true,
      root: '/'
    });
    this.removeRoot = new RegExp('^' + utils.escapeRegExp(this.options.root) + '(#)?');
    this.subscribeEvent('!router:route', this.routeHandler);
    this.subscribeEvent('!router:routeByName', this.routeByNameHandler);
    this.subscribeEvent('!router:reverse', this.reverseHandler);
    this.subscribeEvent('!router:changeURL', this.changeURLHandler);
    this.createHistory();
  }

  Router.prototype.createHistory = function() {
    return Backbone.history || (Backbone.history = new Backbone.History());
  };

  Router.prototype.startHistory = function() {
    return Backbone.history.start(this.options);
  };

  Router.prototype.stopHistory = function() {
    if (Backbone.History.started) {
      return Backbone.history.stop();
    }
  };

  Router.prototype.match = function(pattern, target, options) {
    var action, controller, route, _ref;
    if (options == null) {
      options = {};
    }
    if (arguments.length === 2 && typeof target === 'object') {
      options = target;
      controller = options.controller, action = options.action;
      if (!(controller && action)) {
        throw new Error('Router#match must receive either target or ' + 'options.controller & options.action');
      }
    } else {
      controller = options.controller, action = options.action;
      if (controller || action) {
        throw new Error('Router#match cannot use both target and ' + 'options.controller / options.action');
      }
      _ref = target.split('#'), controller = _ref[0], action = _ref[1];
    }
    route = new Route(pattern, controller, action, options);
    Backbone.history.handlers.push({
      route: route,
      callback: route.handler
    });
    return route;
  };

  Router.prototype.route = function(path, options) {
    var handler, _i, _len, _ref;
    options = options ? _.clone(options) : {};
    _(options).defaults({
      changeURL: true
    });
    path = path.replace(this.removeRoot, '');
    _ref = Backbone.history.handlers;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      handler = _ref[_i];
      if (handler.route.test(path)) {
        handler.callback(path, options);
        return true;
      }
    }
    return false;
  };

  Router.prototype.routeHandler = function(path, options, callback) {
    var routed;
    if (arguments.length === 2 && typeof options === 'function') {
      callback = options;
      options = {};
    }
    routed = this.route(path, options);
    return typeof callback === "function" ? callback(routed) : void 0;
  };

  Router.prototype.routeByNameHandler = function(name, params, options, callback) {
    var path, routed;
    if (arguments.length === 3 && typeof options === 'function') {
      callback = options;
      options = {};
    }
    path = this.reverse(name, params);
    if (typeof path === 'string') {
      routed = this.route(path, options);
      return typeof callback === "function" ? callback(routed) : void 0;
    } else {
      return typeof callback === "function" ? callback(false) : void 0;
    }
  };

  Router.prototype.reverse = function(name, params) {
    var handler, url, _i, _len, _ref;
    _ref = Backbone.history.handlers;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      handler = _ref[_i];
      if (!(handler.route.name === name)) {
        continue;
      }
      url = handler.route.reverse(params);
      if (url !== false) {
        return url;
      }
    }
    return false;
  };

  Router.prototype.reverseHandler = function(name, params, callback) {
    return callback(this.reverse(name, params));
  };

  Router.prototype.changeURL = function(url, options) {
    var navigateOptions;
    if (options == null) {
      options = {};
    }
    navigateOptions = {
      trigger: options.trigger === true,
      replace: options.replace === true
    };
    return Backbone.history.navigate(url, navigateOptions);
  };

  Router.prototype.changeURLHandler = function(url, options) {
    return this.changeURL(url, options);
  };

  Router.prototype.disposed = false;

  Router.prototype.dispose = function() {
    if (this.disposed) {
      return;
    }
    this.stopHistory();
    delete Backbone.history;
    this.unsubscribeAllEvents();
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Router;

})();

}});;require.define({'chaplin/lib/delayer': function(exports, require, module) {
'use strict';
var Delayer;

Delayer = {
  setTimeout: function(name, time, handler) {
    var handle, wrappedHandler, _ref,
      _this = this;
    if ((_ref = this.timeouts) == null) {
      this.timeouts = {};
    }
    this.clearTimeout(name);
    wrappedHandler = function() {
      delete _this.timeouts[name];
      return handler();
    };
    handle = setTimeout(wrappedHandler, time);
    this.timeouts[name] = handle;
    return handle;
  },
  clearTimeout: function(name) {
    if (!(this.timeouts && (this.timeouts[name] != null))) {
      return;
    }
    clearTimeout(this.timeouts[name]);
    delete this.timeouts[name];
  },
  clearAllTimeouts: function() {
    var handle, name, _ref;
    if (!this.timeouts) {
      return;
    }
    _ref = this.timeouts;
    for (name in _ref) {
      handle = _ref[name];
      this.clearTimeout(name);
    }
  },
  setInterval: function(name, time, handler) {
    var handle, _ref;
    this.clearInterval(name);
    if ((_ref = this.intervals) == null) {
      this.intervals = {};
    }
    handle = setInterval(handler, time);
    this.intervals[name] = handle;
    return handle;
  },
  clearInterval: function(name) {
    if (!(this.intervals && this.intervals[name])) {
      return;
    }
    clearInterval(this.intervals[name]);
    delete this.intervals[name];
  },
  clearAllIntervals: function() {
    var handle, name, _ref;
    if (!this.intervals) {
      return;
    }
    _ref = this.intervals;
    for (name in _ref) {
      handle = _ref[name];
      this.clearInterval(name);
    }
  },
  clearDelayed: function() {
    this.clearAllTimeouts();
    this.clearAllIntervals();
  }
};

if (typeof Object.freeze === "function") {
  Object.freeze(Delayer);
}

module.exports = Delayer;

}});;require.define({'chaplin/lib/event_broker': function(exports, require, module) {
'use strict';
var EventBroker, mediator,
  __slice = [].slice;

mediator = require('chaplin/mediator');

EventBroker = {
  subscribeEvent: function(type, handler) {
    if (typeof type !== 'string') {
      throw new TypeError('EventBroker#subscribeEvent: ' + 'type argument must be a string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('EventBroker#subscribeEvent: ' + 'handler argument must be a function');
    }
    mediator.unsubscribe(type, handler, this);
    return mediator.subscribe(type, handler, this);
  },
  unsubscribeEvent: function(type, handler) {
    if (typeof type !== 'string') {
      throw new TypeError('EventBroker#unsubscribeEvent: ' + 'type argument must be a string');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('EventBroker#unsubscribeEvent: ' + 'handler argument must be a function');
    }
    return mediator.unsubscribe(type, handler);
  },
  unsubscribeAllEvents: function() {
    return mediator.unsubscribe(null, null, this);
  },
  publishEvent: function() {
    var args, type;
    type = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    if (typeof type !== 'string') {
      throw new TypeError('EventBroker#publishEvent: ' + 'type argument must be a string');
    }
    return mediator.publish.apply(mediator, [type].concat(__slice.call(args)));
  }
};

if (typeof Object.freeze === "function") {
  Object.freeze(EventBroker);
}

module.exports = EventBroker;

}});;require.define({'chaplin/lib/support': function(exports, require, module) {
'use strict';
var support;

support = {
  propertyDescriptors: (function() {
    var o;
    if (!(typeof Object.defineProperty === 'function' && typeof Object.defineProperties === 'function')) {
      return false;
    }
    try {
      o = {};
      Object.defineProperty(o, 'foo', {
        value: 'bar'
      });
      return o.foo === 'bar';
    } catch (error) {
      return false;
    }
  })()
};

module.exports = support;

}});;require.define({'chaplin/lib/composition': function(exports, require, module) {
'use strict';
var Backbone, Composition, EventBroker, _,
  __hasProp = {}.hasOwnProperty;

_ = require('underscore');

Backbone = require('backbone');

EventBroker = require('chaplin/lib/event_broker');

module.exports = Composition = (function() {

  Composition.extend = Backbone.Model.extend;

  _(Composition.prototype).extend(Backbone.Events);

  _(Composition.prototype).extend(EventBroker);

  Composition.prototype.item = null;

  Composition.prototype.options = null;

  Composition.prototype._stale = false;

  function Composition(options) {
    if (options != null) {
      this.options = _.clone(options);
    }
    this.item = this;
    this.initialize(this.options);
  }

  Composition.prototype.initialize = function() {};

  Composition.prototype.compose = function() {};

  Composition.prototype.check = function(options) {
    return _.isEqual(this.options, options);
  };

  Composition.prototype.stale = function(value) {
    var item, name;
    if (value == null) {
      return this._stale;
    }
    this._stale = value;
    for (name in this) {
      item = this[name];
      if (item && item !== this && _(item).has('stale')) {
        item.stale = value;
      }
    }
  };

  Composition.prototype.disposed = false;

  Composition.prototype.dispose = function() {
    var obj, prop, properties, _i, _len;
    if (this.disposed) {
      return;
    }
    for (prop in this) {
      if (!__hasProp.call(this, prop)) continue;
      obj = this[prop];
      if (obj && typeof obj.dispose === 'function') {
        if (obj !== this) {
          obj.dispose();
          delete this[prop];
        }
      }
    }
    this.unsubscribeAllEvents();
    this.stopListening();
    properties = ['redirected'];
    for (_i = 0, _len = properties.length; _i < _len; _i++) {
      prop = properties[_i];
      delete this[prop];
    }
    this.disposed = true;
    return typeof Object.freeze === "function" ? Object.freeze(this) : void 0;
  };

  return Composition;

})();

}});;require.define({'chaplin/lib/sync_machine': function(exports, require, module) {
'use strict';
var STATE_CHANGE, SYNCED, SYNCING, SyncMachine, UNSYNCED, event, _fn, _i, _len, _ref;

UNSYNCED = 'unsynced';

SYNCING = 'syncing';

SYNCED = 'synced';

STATE_CHANGE = 'syncStateChange';

SyncMachine = {
  _syncState: UNSYNCED,
  _previousSyncState: null,
  syncState: function() {
    return this._syncState;
  },
  isUnsynced: function() {
    return this._syncState === UNSYNCED;
  },
  isSynced: function() {
    return this._syncState === SYNCED;
  },
  isSyncing: function() {
    return this._syncState === SYNCING;
  },
  unsync: function() {
    var _ref;
    if ((_ref = this._syncState) === SYNCING || _ref === SYNCED) {
      this._previousSync = this._syncState;
      this._syncState = UNSYNCED;
      this.trigger(this._syncState, this, this._syncState);
      this.trigger(STATE_CHANGE, this, this._syncState);
    }
  },
  beginSync: function() {
    var _ref;
    if ((_ref = this._syncState) === UNSYNCED || _ref === SYNCED) {
      this._previousSync = this._syncState;
      this._syncState = SYNCING;
      this.trigger(this._syncState, this, this._syncState);
      this.trigger(STATE_CHANGE, this, this._syncState);
    }
  },
  finishSync: function() {
    if (this._syncState === SYNCING) {
      this._previousSync = this._syncState;
      this._syncState = SYNCED;
      this.trigger(this._syncState, this, this._syncState);
      this.trigger(STATE_CHANGE, this, this._syncState);
    }
  },
  abortSync: function() {
    if (this._syncState === SYNCING) {
      this._syncState = this._previousSync;
      this._previousSync = this._syncState;
      this.trigger(this._syncState, this, this._syncState);
      this.trigger(STATE_CHANGE, this, this._syncState);
    }
  }
};

_ref = [UNSYNCED, SYNCING, SYNCED, STATE_CHANGE];
_fn = function(event) {
  return SyncMachine[event] = function(callback, context) {
    if (context == null) {
      context = this;
    }
    this.on(event, callback, context);
    if (this._syncState === event) {
      return callback.call(context);
    }
  };
};
for (_i = 0, _len = _ref.length; _i < _len; _i++) {
  event = _ref[_i];
  _fn(event);
}

if (typeof Object.freeze === "function") {
  Object.freeze(SyncMachine);
}

module.exports = SyncMachine;

}});;require.define({'chaplin/lib/utils': function(exports, require, module) {
'use strict';
var support, utils, _,
  __slice = [].slice,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ = require('underscore');

support = require('chaplin/lib/support');

utils = {
  beget: (function() {
    var ctor;
    if (typeof Object.create === 'function') {
      return Object.create;
    } else {
      ctor = function() {};
      return function(obj) {
        ctor.prototype = obj;
        return new ctor;
      };
    }
  })(),
  serialize: function(data) {
    if (typeof data.serialize === 'function') {
      return data.serialize();
    } else if (typeof data.toJSON === 'function') {
      return data.toJSON();
    } else {
      throw new TypeError('utils.serialize: Unknown data was passed');
    }
  },
  readonly: (function() {
    var readonlyDescriptor;
    if (support.propertyDescriptors) {
      readonlyDescriptor = {
        writable: false,
        enumerable: true,
        configurable: false
      };
      return function() {
        var obj, prop, properties, _i, _len;
        obj = arguments[0], properties = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
        for (_i = 0, _len = properties.length; _i < _len; _i++) {
          prop = properties[_i];
          readonlyDescriptor.value = obj[prop];
          Object.defineProperty(obj, prop, readonlyDescriptor);
        }
        return true;
      };
    } else {
      return function() {
        return false;
      };
    }
  })(),
  getPrototypeChain: function(object) {
    var chain, _ref;
    chain = [object.constructor.prototype];
    while (object = (_ref = object.constructor) != null ? _ref.__super__ : void 0) {
      chain.push(object);
    }
    return chain;
  },
  getAllPropertyVersions: function(object, property) {
    var proto, result, value, _i, _len, _ref;
    result = [];
    _ref = utils.getPrototypeChain(object);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      proto = _ref[_i];
      value = proto[property];
      if (value && __indexOf.call(result, value) < 0) {
        result.push(value);
      }
    }
    return result.reverse();
  },
  upcase: function(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
  },
  underscorize: function(string) {
    return string.replace(/[A-Z]/g, function(char, index) {
      return (index !== 0 ? '_' : '') + char.toLowerCase();
    });
  },
  escapeRegExp: function(str) {
    return String(str || '').replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
  },
  modifierKeyPressed: function(event) {
    return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  }
};

if (typeof Object.seal === "function") {
  Object.seal(utils);
}

module.exports = utils;

}});;require.define({'chaplin': function(exports, require, module) {

module.exports = {
  Application: require('chaplin/application'),
  mediator: require('chaplin/mediator'),
  Dispatcher: require('chaplin/dispatcher'),
  Controller: require('chaplin/controllers/controller'),
  Composer: require('chaplin/composer'),
  Composition: require('chaplin/lib/composition'),
  Collection: require('chaplin/models/collection'),
  Model: require('chaplin/models/model'),
  Layout: require('chaplin/views/layout'),
  View: require('chaplin/views/view'),
  CollectionView: require('chaplin/views/collection_view'),
  Route: require('chaplin/lib/route'),
  Router: require('chaplin/lib/router'),
  Delayer: require('chaplin/lib/delayer'),
  EventBroker: require('chaplin/lib/event_broker'),
  support: require('chaplin/lib/support'),
  SyncMachine: require('chaplin/lib/sync_machine'),
  utils: require('chaplin/lib/utils')
};

}});