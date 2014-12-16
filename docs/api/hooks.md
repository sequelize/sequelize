<a name="hooks"></a>
# Mixin Hooks
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L37)
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
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L149)
Add a hook to the model


**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| hooktype | String |  |
| [name] | String | Provide a name for the hook function. This serves no purpose, other than the ability to be able to order hooks based on some sort of priority system in the future. |
| fn | Function | The hook function  |

__Aliases:__ hook

***

<a name="beforevalidate"></a>
## `beforeValidate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L169)
A hook that is run before validation

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err) |


***

<a name="aftervalidate"></a>
## `afterValidate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L178)
A hook that is run after validation

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err) |


***

<a name="beforecreate"></a>
## `beforeCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L187)
A hook that is run before creating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options, callback(err) |


***

<a name="aftercreate"></a>
## `afterCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L196)
A hook that is run after creating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options, callback(err) |


***

<a name="beforedestroy"></a>
## `beforeDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L207)
A hook that is run before destroying a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err)  |

__Aliases:__ beforeDelete

***

<a name="afterdestroy"></a>
## `afterDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L222)
A hook that is run after destroying a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err)  |

__Aliases:__ afterDelete

***

<a name="beforeupdate"></a>
## `beforeUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L235)
A hook that is run before updating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err) |


***

<a name="afterupdate"></a>
## `afterUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L244)
A hook that is run after updating a single instance

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance, options, callback(err) |


***

<a name="beforebulkcreate"></a>
## `beforeBulkCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L253)
A hook that is run before creating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instances, options, callback(err) |


***

<a name="afterbulkcreate"></a>
## `afterBulkCreate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L262)
A hook that is run after creating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instances, options, callback(err) |


***

<a name="beforebulkdestroy"></a>
## `beforeBulkDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L273)
A hook that is run before destroying instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err)  |

__Aliases:__ beforeBulkDelete

***

<a name="afterbulkdestroy"></a>
## `afterBulkDestroy(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L288)
A hook that is run after destroying instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err)  |

__Aliases:__ afterBulkDelete

***

<a name="beforebulkupdate"></a>
## `beforeBulkUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L301)
A hook that is run after updating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err) |


***

<a name="afterbulkupdate"></a>
## `afterBulkUpdate(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L310)
A hook that is run after updating instances in bulk

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err) |


***

<a name="beforefind"></a>
## `beforeFind(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L319)
A hook that is run before a find (select) query

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err) |


***

<a name="beforefindafterexpandincludeall"></a>
## `beforeFindAfterExpandIncludeAll(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L328)
A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err) |


***

<a name="beforefindafteroptions"></a>
## `beforeFindAfterOptions(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L337)
A hook that is run before a find (select) query, after all option parsing is complete

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with options, callback(err) |


***

<a name="afterfind"></a>
## `afterFind(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L346)
A hook that is run after a find (select) query

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with instance(s), options, callback(err) |


***

<a name="beforedefine"></a>
## `beforeDefine(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L355)
A hook that is run before a define call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with attributes, options, callback(err) |


***

<a name="afterdefine"></a>
## `afterDefine(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L364)
A hook that is run after a define call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with factory, callback(err) |


***

<a name="beforeinit"></a>
## `beforeInit(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L373)
A hook that is run before Sequelize() call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with config, options, callback(err) |


***

<a name="afterinit"></a>
## `afterInit(name, fn)`
[View code](https://github.com/sequelize/sequelize/blob/cdd8c3be7961c58c1446cb4893939a2986db9876/lib/hooks.js#L382)
A hook that is run after Sequelize() call

**Params:**

| Name | Type | Description |
| ---- | ---- | ----------- |
| name | String |  |
| fn | Function | A callback function that is called with sequelize, callback(err) |


***

_This document is automatically generated based on source code comments. Please do not edit it directly, as your changes will be ignored. Please write on <a href="irc://irc.freenode.net/#sequelizejs">IRC</a>, open an issue or a create a pull request if you feel something can be improved. For help on how to write source code documentation see [JSDoc](http://usejsdoc.org) and [dox](https://github.com/tj/dox)_