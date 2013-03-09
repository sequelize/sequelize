/**
 * Manage downloads
 */


(function() {

var cache = {};
var form = $('form');
var minified = true;

var dependencies = {};

for (var category in components) {
	var all = components[category];
	
	all.meta.section = $u.element.create('section', {
		className: 'options',
		contents: {
			tag: 'h1',
			contents: category.charAt(0).toUpperCase() + category.slice(1)
		},
		inside: '#components'
	});
	
	for (var id in all) {
		if(id === 'meta') {
			continue;
		}
		
		var checked = false, disabled = false;
		var option = all[id].option || all.meta.option;
		
		switch (option) {		
			case 'mandatory': disabled = true; // fallthrough
			case 'default': checked = true;
		}
		
		var filepath = all.meta.path.replace(/\{id}/g, id);
		
		var info = all[id] = {
			title: all[id].title || all[id],
			hasCSS: all[id].hasCSS !== undefined? all[id].hasCSS : all.meta.hasCSS,
			enabled: checked,
			require: all[id].require,
			files: {
				minified: {
					paths: [],
					size: 0
				},
				dev: {
					paths: [],
					size: 0
				}
			}
		};
		
		if (info.require) {
			dependencies[info.require] = (dependencies[info.require] || []).concat(id);
		}
		
		if (!/\.css$/.test(filepath)) {
			info.files.minified.paths.push(filepath.replace(/(\.js)?$/, '.min.js'));
			info.files.dev.paths.push(filepath.replace(/(\.js)?$/, '.js'));
		}
		
		if ((all[id].hasCSS && !/\.js$/.test(filepath)) || /\.css$/.test(filepath)) {
			var cssFile = filepath.replace(/(\.css)?$/, '.css');
			
			info.files.minified.paths.push(cssFile);
			info.files.dev.paths.push(cssFile);
		}
	
		$u.element.create('label', {
			attributes: {
				'data-id': id
			},
			contents: [
				{
					tag: 'input',
					properties: {
						type: all.meta.exclusive? 'radio' : 'checkbox',
						name: 'download-' + category,
						value: id,
						checked: checked,
						disabled: disabled,
						onclick: (function(id, category, all){
							return function () {
								$$('input[name="' + this.name + '"]').forEach(function(input) {
									all[input.value].enabled = input.checked;
								});

								if (all[id].require && this.checked) {
									var input = $('label[data-id="' + all[id].require + '"] > input');
									input.checked = true;
									
									input.onclick();
								}

								if (dependencies[id] && !this.checked) { // It’s required by others
									dependencies[id].forEach(function(dependent) {
										var input = $('label[data-id="' + dependent + '"] > input');
										input.checked = false;

										input.onclick();
									});
								}
								
								update(category, id);
							};
						})(id, category, all)
					}
				},
				all.meta.link? {
					tag: 'a',
					properties: {
						href: all.meta.link.replace(/\{id}/g, id)
					},
					contents: info.title
				} : info.title,
				' ',
				{
					tag: 'strong',
					className: 'filesize'
				}
			],
			inside: all.meta.section
		});
	}
}

form.elements.compression[0].onclick = 
form.elements.compression[1].onclick = function() {
	minified = !!+this.value;
	
	fetchFiles();
}

function fetchFiles() {
	for (var category in components) {
		var all = components[category];
		
		for (var id in all) {
			if(id === 'meta') {
				continue;
			}
			
			var distro = all[id].files[minified? 'minified' : 'dev'],
			    files = distro.paths;
				
			files.forEach(function (filepath) {
				var file = cache[filepath] = cache[filepath] || {};
				
				if (!file.contents) {
	
					(function(category, id, file, filepath, distro){
	
					$u.xhr({
						url: filepath,
						callback: function(xhr) {
							if (xhr.status < 400) {
								
								file.contents = xhr.responseText;
								
								file.size = +xhr.getResponseHeader('Content-Length') || file.contents.length;
	
								distro.size += file.size;
								
								update(category, id);
							}
						}
					});
					})(category, id, file, filepath, distro);
				}
				else {
					update(category, id);
				}
			});
		}
	}
}

fetchFiles();

function prettySize(size) {
	return Math.round(100 * size / 1024)/100 + 'KB';
}

function update(updatedCategory, updatedId){
	// Update total size
	var total = {js: 0, css: 0}, updated = {js: 0, css: 0};
	
	for (var category in components) {
		var all = components[category];
		
		for (var id in all) {
			var info = all[id];
			
			if (info.enabled || id == updatedId) {
				var distro = info.files[minified? 'minified' : 'dev'];
				
				distro.paths.forEach(function(path) {
					if (cache[path]) {
						var type = path.match(/\.(\w+)$/)[1],
						    size = cache[path].size || 0;
						    
						if (info.enabled) {
							total[type] += size;
						}
						
						if (id == updatedId) {
							updated[type] += size;
						}
					}
				});
			}
		}
	}
	
	total.all = total.js + total.css;
	updated.all = updated.js + updated.css;
	
	$u.element.prop($('label[data-id="' + updatedId + '"] .filesize'), {
		textContent: prettySize(updated.all),
		title: (updated.js? Math.round(100 * updated.js / updated.all) + '% JavaScript' : '') + 
				(updated.js && updated.css? ' + ' : '') +
				(updated.css? Math.round(100 * updated.css / updated.all) + '% CSS' : '')
	});
	
	$('#filesize').textContent = prettySize(total.all);
	
	$u.element.prop($('#percent-js'), {
		textContent: Math.round(100 * total.js / total.all) + '%',
		title: prettySize(total.js)
	});
	
	$u.element.prop($('#percent-css'), {
		textContent: Math.round(100 * total.css / total.all) + '%',
		title: prettySize(total.css)
	});
	
	generateCode();
}

function generateCode(){
	var code = {js: '', css: ''};
	
	for (var category in components) {
		var all = components[category];
		
		for (var id in all) {
			if(id === 'meta') {
				continue;
			}
			
			var info = all[id];
			if (info.enabled) {
				info.files[minified? 'minified' : 'dev'].paths.forEach(function (path) {
					if (cache[path]) {
						var type = path.match(/\.(\w+)$/)[1];
						
						code[type] += cache[path].contents + (type === 'js'? ';' : '') + '\n';
					}
				});
			}
		}
	}
	
	for (var type in code) {
		var codeElement = $('#download-' + type + ' code');
		
		codeElement.textContent = code[type];
		Prism.highlightElement(codeElement, true);
		
		$('#download-' + type + ' .download-button').href = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(code[type]);
	}
}

})();