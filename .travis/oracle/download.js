var system = require('system');
var env = system.env;

function javascriptRequired () {
	page.onLoadFinished = dumpCookies;
	page.evaluate(function () { document.forms[0].submit(); });
}

function dumpCookies () {
	var file = require('fs').open(env['COOKIES'], 'w');
	for (var i = 0; i < phantom.cookies.length; ++i) {
		var cookie = phantom.cookies[i];
		file.writeLine(cookie.domain + "\tTRUE\t" + cookie.path
			+ "\t" + (cookie.secure ? "TRUE" : "FALSE") + "\t0\t"
			+ cookie.name + "\t" + cookie.value
		);
	}
	file.close();
	serializeLoginForm();
}

function serializeLoginForm () {
	page.includeJs('https://ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min.js', function () {
		var data = page.evaluate(function () { return jQuery(document.forms[0]).serialize(); });
		for (var key in env) {
			if (key.indexOf('ORACLE_LOGIN_') == 0 && env.hasOwnProperty(key)) {
				var name = key.substr(13) + '=';
				data = data.replace(name, name + env[key]);
			}
		}
		system.stdout.writeLine(data);
		phantom.exit();
	});
}

phantom.addCookie({'name': 'oraclelicense', 'value': 'accept-sqldev-cookie', 'domain': '.oracle.com' });

var page = require('webpage').create();
page.settings.userAgent = env['USER_AGENT'];

page.onResourceError = function(error) { system.stderr.writeLine(JSON.stringify(error)); phantom.exit(1); }
page.onLoadFinished = javascriptRequired;
page.open('https://edelivery.oracle.com/akam/otn/linux/oracle11g/xe/' + env['ORACLE_FILE']);
