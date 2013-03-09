/*global module */
module.exports = function (grunt) {
	'use strict';

	grunt.initConfig({
		qunit: {
			files: ['test/index.html']
		},
		lint: {
			files: [
				'grunt.js',
				'jquery.cookie.js'
			]
		},
		jshint: {
			options: {
				boss: true,
				browser: true,
				curly: true,
				eqeqeq: true,
				eqnull: true,
				expr: true,
				evil: true,
				newcap: true,
				noarg: true,
				undef: true
			},
			globals: {
				jQuery: true
			}
		}
	});

	grunt.registerTask('default', 'lint qunit');

	// Travis CI task.
	grunt.registerTask('ci', 'default');
};
