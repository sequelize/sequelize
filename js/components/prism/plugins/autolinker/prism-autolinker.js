(function(){

if (!self.Prism) {
	return;
}

var url = /\b([a-z]{3,7}:\/\/|tel:)[\w-+%~/.]+/,
    email = /\b\S+@[\w.]+[a-z]{2}/,
    linkMd = /\[([^\]]+)]\(([^)]+)\)/,
    
	// Tokens that may contain URLs and emails
    candidates = ['comment', 'url', 'attr-value', 'string'];

for (var language in Prism.languages) {
	var tokens = Prism.languages[language];
	
	Prism.languages.DFS(tokens, function (type, def) {
		if (candidates.indexOf(type) > -1) {
			if (!def.pattern) {
				def = this[type] = {
					pattern: def
				};
			}
			
			def.inside = def.inside || {};
			
			if (type == 'comment') {
				def.inside['md-link'] = linkMd;
			}
			
			def.inside['url-link'] = url;
			def.inside['email-link'] = email;
		}
	});
	
	tokens['url-link'] = url;
	tokens['email-link'] = email;
}

Prism.hooks.add('wrap', function(env) {
	if (/-link$/.test(env.type)) {
		env.tag = 'a';
		
		var href = env.content;
		
		if (env.type == 'email-link') {
			href = 'mailto:' + href;
		}
		else if (env.type == 'md-link') {
			// Markdown
			var match = env.content.match(linkMd);
			
			href = match[2];
			env.content = match[1];
		}
		
		env.attributes.href = href;
	}
});

})();