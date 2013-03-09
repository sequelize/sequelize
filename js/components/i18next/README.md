# Introduction

Project goal is to provide an easy way to translate a website on clientside:

- fetch resources from server
- fetch each resource file individually (static) or all once via dynamicRoute
- apply translation to HTML tags with the _data-i18n_ attribute
- post missing key-value pairs to server (for easy development -> just translate the new keys)
- search for key _en-US_ first, then in _en_, then in fallback language (or de-DE, de , fallback)

Check out the [documentation](http://i18next.com)

# Usage

Assuming we loaded __en-US__, __en__ and __dev__ resources for two namespaces ('ns.special' and 'ns.common'):

	// given loaded and merged dictionaries in i18next.js to:
	{
	    "en_US": {
	        "ns.special": {
	            "app": {
	                "name": "i18n",
	                "insert": "you are __youAre__",
	                "child": "__count__ child",
	                "child_plural": "__count__ children"
	            }
	        },
	        "ns.common": {}
	    },
	    "en": {
	        "ns.special": {
	            "app": {
	                "area": "Area 51"
	            }
	        },
	        "ns.common": {}
	    },
	    "dev": {
	        "ns.common": {
	            "app": {
	                "company": {
	                    "name": "my company"
	                }
	            },
	            "add": "add"
	        },
	        "ns.special": {
	            "nav": {
	                "1": "link1",
	                "2": "link2",
	                "home": "home"
	            }
	        }
	    }
	}

## you can translate using `$.t(key, [options])`

	$.i18n.init({
	    lng: 'en-US',
	    ns: { namespaces: ['ns.common', 'ns.special'], defaultNs: 'ns.special'}
	}, function() {
	    $.t('app.name'); // -> i18n (from en-US resourcefile)
	    $.t('app.area'); // -> Area 51 (from en resourcefile)
	    $.t('ns.common:app.company.name'); // -> my company (from dev resourcefile)
	    $.t('ns.common:add'); // -> add (from dev resourcefile)
	});

### insert values into your translation

	$.t('app.insert', {youAre: 'great'}) // -> you are great

### support for plurals

	$.t('app.child', {count: 1}) // -> 1 child
	$.t('app.child', {count: 3}) // -> 3 children

## or you can just `$('.mySelector').i18n()` assuming you have added the `data-i18n="key"` attribute to your elements

	// given
	<ul class="nav">
		<li class="active"><a href="#" data-i18n="nav.home">home</a></li>
		<li><a href="#" data-i18n="nav.1">link1</a></li>
		<li><a href="#" data-i18n="nav.2">link2</a></li>
	</ul>

	// Run the following javascript to translate all elements having the _data-i18n_ attribute:
	$.i18n.init({
	    lng: 'en-US',
	    ns: { namespaces: ['ns.common', 'ns.special'], defaultNs: 'ns.special'}
	}, function() {
	    $('.nav').i18n();
	});

For missing keys (if the option 'addMissing' is set to true) will be send to server with actual text as defaultValue.

# Sample usage

In the folder you find one static sample.

# serverside integrations

[i18next-node](https://github.com/jamuhl/i18next-node) is bringing i18next to node.js

# Inspiration

- [jsperanto](https://github.com/jpjoyal/jsperanto).

# Building
To build your own copy of i18next, check out the repository and:

	git clone https://github.com/jamuhl/i18next.git
    cd i18next
    npm install grunt -g
    npm install
    grunt
    
The grunt command will build i18next into the bin/ and release/ folders.

# License

Copyright (c) 2011 Jan Mühlemann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
