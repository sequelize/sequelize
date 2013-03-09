### 1.6.0
- option to specify target to set attributes with jquery function by using 'data-i18n-target attribute'
- function to set new options for nesting functionality
- function to add resources after init
- option to lookup in default namespace if value is not found in given namespace
- option to change interpolation prefix and suffix via translation options
- fixed issue with using ns/keyseparator on plurals, context,...
- fixed issue with posting missing when not using jquery
- post missing in correct lng if lng is given in translation options
- proper usage of deferred object in init function
- fixed issue replacing values in objectTree

### 1.5.10
- BREAKING: fixed plural rules for languages with extended plural forms (more than 2 forms)
- merged pull #61 - custom loader (enables jsonp or other loading custom loading strategies)
- escaping interpolation prefix/suffix for proper regex replace

### 1.5.9
- functions to load additional namespaces after init and to set default namespace to something else
- set if you don't want to read defaultValues from content while using jquery fc
- set dataAttribute to different value
- set cookieName to different value
- some smallbugfixes
- typesafe use of console if in debug mode

### 1.5.8
- disable cookie usage by setting init option useCookie to false
- accept empty string as translation value
- fixed bug in own ajax implementation not using proper sendType
- fixed bug for returning objTree in combination with namespace
- fixed bug in plurals of romanic lngs

### 1.5.7
- pass namespace in t() options
- interpolation nesting
- changable querystring param to look language up from

###	1.5.6
- typesafe check for window, document existance
- runnable under rhino
- seperated amd builds with/without jquery

### 1.5.5
- __BREAKING__ added all plurals: suffixes will new be same as in gettext usage (number indexes key_plural_0|2|3|4|5|7|8|10|11|20|100), additional if needed signature of addRule has changed
- added sprintf as postprocessor -> postProcess = 'sprintf' and sprintf = obj or array
- set default postProcessor on init
- redone build process with grunt
- drop in replacement for jquery each, extend, ajax
- setting fallbackLng to false will stop loading and looking it up
- option to load only current or unspecific language files

### v1.5.0
- pass options to sync._fetchOne, use options for fetching
- support for i18next-webtranslate

### v1.4.1
- post processor
- __BREAKING:__ localStorage defaults to false
- added localStorageExpirationTime for better caching control
- few bug fixes

### v1.4.0
- preload multiple languages
- translate key to other language than current
- fixed issue with namespace usage in combination with context and plurals
- more options to send missing values
- better amd support

### v1.3.4
- set type of ajax request to GET (options sendType: default POST)
- set cookie expiration (options cookieExpirationTime: in minutes)
- read / cache translation options (context, count, ...) in data-attribute (options useDataAttrOptions: default false)

### v1.3.3
- optional return an objectTree from translation
- use jquery promises or callback in initialisation
- rewrote all tests with mocha.js

### v1.3.2
- options to init i18next sync (options -> getAsync = false)
- replace all occurence of replacement string

### v1.3.1
- pass options to selector.i18n() thanks to [@hugojosefson](https://github.com/jamuhl/i18next/pull/10)
- close [issue #8(https://github.com/jamuhl/i18next/issues/8)]: Fail silently when trying to access a path with children
- cleanup
- debug flag (options.debug -> write infos/errors to console)

### v1.2.5
- fix for IE8

### v1.2.4
- added indexOf for non ECMA-262 standard compliant browsers (IE < 9)
- calling i28n() on element with data-i18n attribute will localize it now (i18n now not only works on container elements child)

### v1.2.3

- extended detectLng: switch via qs _setLng=_ or cookie _i18next_
- assert county in locale will be uppercased `en-us` -> `en-US`
- provide option to have locale always lowercased _option lowerCaseLng_
- set lng cookie when set in init function

### v1.2

- support for translation context
- fixed zero count in plurals
- init without options, callback

### v1.1

- support for multiple plural forms
- common.js enabled (for node.js serverside)
- changes to be less dependent on jquery (override it's functions, add to root if no jquery)
- enable it on serverside with node.js [i18next-node](https://github.com/jamuhl/i18next-node)

### v1.0

- support for other attribute translation via _data-i18n_ attribute
- bug fixes
- tests with qunit and sinon

### v0.9

- multi-namespace support
- loading static files or dynamic route
- jquery function for _data-i18n_ attibute
- post missing translations to the server
- graceful fallback en-US -> en -> fallbackLng
- localstorage support
- support for pluralized strings
- insertion of variables into translations
- translation nesting