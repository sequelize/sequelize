#!/usr/bin/env python
import sys
import os
from builder import RainbowBuilder

sys.argv.pop(0)
languages = sys.argv
languages.sort()

no_language_args = ['--alone', '--forever-alone', '--core', '--no-languages', '--without-languages', '--none']
rainbow_only = len(set(no_language_args) - set(sys.argv)) < len(no_language_args)

if not rainbow_only:
    languages.insert(0, 'generic')

js_path = os.path.dirname(__file__) + '/../js/'

for language in languages[:]:
    if language.startswith('--'):
        languages.remove(language)

builder = RainbowBuilder(js_path, '/usr/local/compiler-latest/compiler.jar')

print 'waiting for closure compiler...'
contents = builder.getFileForLanguages(languages)

print "\nincluded:"
for file in builder.js_files_to_include:
    print "    ", os.path.basename(file)
print ""

print 'writing to file:', builder.file_name

new_file = os.path.join(js_path, builder.file_name)

file = open(new_file, "w")
file.write(contents)
file.close()
