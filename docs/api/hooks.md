<a name="hooks"></a>
# Mixin Hooks
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L39)

Hooks are function that are called before and after  (bulk-) creation/updating/deletion and validation. Hooks can be added to you models in three ways:

1. By specifying them as options in `sequelize.define`
2. By calling `hook()` with a string and your hook handler function
3. By calling the function with the same name as the hook you want

```js
// Method 1
sequelize.define(name, { attributes }, {
  hooks: {
    beforeBulkCreate: function () {
      // can be a single function
    },
    beforeValidate: [
      function () {},
      function() {} // Or an array of several
    ]
  }
})

// Method 2
Model.hook('afterDestroy', function () {})

// Method 3
Model.afterBulkUpdate(function () {})
```

**See:**

* [Sequelize#define](sequelize#define)


***

<a name="addhook"></a>
## `addHook(hooktype, [name], fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L155)

Add a hook to the model

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| hooktype | String |  |
| [name] | String | Provide a name for the hook function. It can be used to remove the hook later or to order hooks based on some sort of priority system in the future. |
| fn | Function | The hook function |

__Aliases:__ hook

***

<a name="removehook"></a>
## `removeHook(hookType, name)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L174)

Remove hook from the model

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| hookType | String |  |
| name | String |  |


***

<a name="hashook"></a>
## `hasHook(hookType)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L200)

Check whether the mode has any hooks of this type

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| hookType | String |  |

__Aliases:__ hasHooks

***

<a name="beforevalidate"></a>
## `beforeValidate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L213)

A hook that is run before validation

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="aftervalidate"></a>
## `afterValidate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L220)

A hook that is run after validation

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="validationfailed"></a>
## `validationFailed(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L228)

A hook that is run when validation fails

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, error. Error is the SequelizeValidationError. If the callback throws an error, it will replace the original validation error. |


***

<a name="beforecreate"></a>
## `beforeCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L235)

A hook that is run before creating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options |


***

<a name="aftercreate"></a>
## `afterCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L242)

A hook that is run after creating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options |


***

<a name="beforedestroy"></a>
## `beforeDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L251)

A hook that is run before destroying a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |

__Aliases:__ beforeDelete

***

<a name="afterdestroy"></a>
## `afterDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L260)

A hook that is run after destroying a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |

__Aliases:__ afterDelete

***

<a name="beforerestore"></a>
## `beforeRestore(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L268)

A hook that is run before restoring a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="afterrestore"></a>
## `afterRestore(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L276)

A hook that is run after restoring a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="beforeupdate"></a>
## `beforeUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L283)

A hook that is run before updating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="afterupdate"></a>
## `afterUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L290)

A hook that is run after updating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options |


***

<a name="beforebulkcreate"></a>
## `beforeBulkCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L297)

A hook that is run before creating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instances, options |


***

<a name="afterbulkcreate"></a>
## `afterBulkCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L304)

A hook that is run after creating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instances, options |


***

<a name="beforebulkdestroy"></a>
## `beforeBulkDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L313)

A hook that is run before destroying instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |

__Aliases:__ beforeBulkDelete

***

<a name="afterbulkdestroy"></a>
## `afterBulkDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L322)

A hook that is run after destroying instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |

__Aliases:__ afterBulkDelete

***

<a name="beforebulkrestore"></a>
## `beforeBulkRestore(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L330)

A hook that is run before restoring instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="afterbulkrestore"></a>
## `afterBulkRestore(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L338)

A hook that is run after restoring instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="beforebulkupdate"></a>
## `beforeBulkUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L345)

A hook that is run before updating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="afterbulkupdate"></a>
## `afterBulkUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L352)

A hook that is run after updating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="beforefind"></a>
## `beforeFind(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L359)

A hook that is run before a find (select) query

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="beforefindafterexpandincludeall"></a>
## `beforeFindAfterExpandIncludeAll(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L366)

A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="beforefindafteroptions"></a>
## `beforeFindAfterOptions(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L373)

A hook that is run before a find (select) query, after all option parsing is complete

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="afterfind"></a>
## `afterFind(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L380)

A hook that is run after a find (select) query

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance(s), options |


***

<a name="beforecount"></a>
## `beforeCount(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L387)

A hook that is run before a count query

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options |


***

<a name="beforedefine"></a>
## `beforeDefine(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L394)

A hook that is run before a define call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options |


***

<a name="afterdefine"></a>
## `afterDefine(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L401)

A hook that is run after a define call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with factory |


***

<a name="beforeinit"></a>
## `beforeInit(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L408)

A hook that is run before Sequelize() call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with config, options |


***

<a name="afterinit"></a>
## `afterInit(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L415)

A hook that is run after Sequelize() call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with sequelize |


***

<a name="beforeconnect"></a>
## `beforeConnect(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L422)

A hook that is run before a connection is created

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with config passed to connection |


***

<a name="beforesync"></a>
## `beforeSync(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L429)

A hook that is run before Model.sync call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options passed to Model.sync |


***

<a name="aftersync"></a>
## `afterSync(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L436)

A hook that is run after Model.sync call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options passed to Model.sync |


***

<a name="beforebulksync"></a>
## `beforeBulkSync(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L443)

A hook that is run before sequelize.sync call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options passed to sequelize.sync |


***

<a name="afterbulksync"></a>
## `afterBulkSync`
[View code](https://github.com/sequelize/sequelize/blob/e7f5544bf5353441d3f1abcf9861c8345c93f84b/lib/hooks.js#L451)

A hook that is run after sequelize.sync call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options passed to sequelize.sync |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_