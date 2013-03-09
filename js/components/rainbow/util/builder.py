import os
import subprocess
import zipfile
import hashlib
import re
import glob
from zipfile import ZipFile
from StringIO import StringIO


class RainbowBuilder(object):

    def __init__(self, js_path, closure_path, theme_path=None):

        self.versions = {
            'c': '1.0.2',
            'css': '1.0.6',
            'generic': '1.0.6',
            'html': '1.0.4',
            'javascript': '1.0.6',
            'php': '1.0.3',
            'python': '1.0.5',
            'ruby': '1.0.5',
            'shell': '1.0.3'
        }

        self.js_path = js_path
        self.closure_path = closure_path
        self.js_files_to_include = []
        self.file_name = ""
        self.theme_path = theme_path

    def getPathForLanguage(self, language):
        return os.path.join(self.js_path, 'language/' + language + '.js')

    def getRainbowPath(self):
        return os.path.join(self.js_path, 'rainbow.js')

    def verifyPaths(self):
        if not os.path.exists(self.js_path):
            raise Exception('directory does not exist at: %s' % self.js_path)

        if not os.path.isfile(self.closure_path):
            raise Exception('closure compiler does not exist at: %s' % self.closure_path)

    def getZipForLanguages(self, languages, path=None):
        self.verifyPaths()

        # strip out any duplicates
        languages = list(set(languages))

        write_to = StringIO() if path is None else path
        zip_file = ZipFile(write_to, 'w')
        zip_file.write(self.getRainbowPath(), 'rainbow.js', zipfile.ZIP_DEFLATED)

        # include minimized version even when downloading the dev version
        zip_file.write(self.getRainbowPath().replace('.js', '.min.js'), 'rainbow.min.js', zipfile.ZIP_DEFLATED)

        # include themes as well
        if self.theme_path:
            files = glob.glob(self.theme_path + '/*.css')
            for file_name in files:
                zip_file.write(file_name, os.path.join('themes', os.path.basename(file_name)), zipfile.ZIP_DEFLATED)

        for language in languages:
            zip_file.write(self.getPathForLanguage(language), os.path.join('language', language + '.js'), zipfile.ZIP_DEFLATED)

        zip_file.close()

        return write_to

    def openFile(self, path):
        file = open(path, "r")
        content = file.read()
        file.close()
        return content

    def writeFile(self, path, content):
        file = open(path, "w")
        file.write(content)
        file.close()

    def getVersion(self):
        contents = self.openFile(self.getRainbowPath())
        match = re.search(r'@version\s(.*)\s+?', contents)
        return match.group(1)

    def getLanguageVersions(self, languages):
        groups = []
        for language in languages:
            if language in self.versions:
                groups.append(language + ' v' + self.versions[language])

        return ', '.join(groups)

    def getFileForLanguages(self, languages, cache=None):
        self.verifyPaths()

        # strip out any duplicates
        languages = list(set(languages))

        self.js_files_to_include = [self.getRainbowPath()]
        for language in languages:
            path = self.getPathForLanguage(language)
            if not os.path.exists(path):
                continue

            self.js_files_to_include.append(path)

        self.file_name = 'rainbow' + ('-custom' if len(languages) else '') + '.min.js'

        if cache is not None:
            version = self.getVersion()
            cache_key = 'rainbow_' + hashlib.md5(self.getLanguageVersions(languages)).hexdigest() + '_' + version
            cached_version = cache.get(cache_key)
            if cached_version:
                return cached_version

        command = ['java', '-jar', self.closure_path, '--compilation_level', 'ADVANCED_OPTIMIZATIONS'] + self.js_files_to_include
        proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        output, err = proc.communicate()

        lines = output.splitlines()
        comments = lines[0:4]
        version = comments[1].replace(' @version ', '')
        url = comments[2].replace(' @url ', '')
        new_comment = '/* Rainbow v' + version + ' ' + url

        if len(languages):
            new_comment += ' | included languages: ' + ', '.join(languages)

        new_comment += ' */'

        output = new_comment + '\n' + '\n'.join(lines[4:])

        if cache is not None:
            cache.set(cache_key, output, 14400)  # 4 hours

        return output
