var http = require('http');
var url  = require('url');
var path = require('path');
var fs   = require('fs');

http.createServer(function(request, response) {
	var uri = url.parse(request.url).pathname;
	var filename = path.join(process.cwd(), uri);

	fs.readFile(filename, 'binary', function(err, file) {
		if (err) {
			response.writeHead(500, { 'Content-Type': 'text/plain' });
			response.write(err + '\n');
			response.end();
			return;
		}

		response.writeHead(200, filename.match(/\.js$/) ? { 'Content-Type': 'text/javascript' } : {});
		response.write(file, 'utf-8');
		response.end();
	});
}).listen(8124, '0.0.0.0');

console.log('Test suite at http://0.0.0.0:8124/test/index.html');
