import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import aliases from './aliases.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a bundle.
_build({
  minify: false,
});

// Create a minified version of the bundle.
_build({
  minify: true,
});

function _build({
  minify,
}) {
  return build({
    // Builds a "bundle" from the output of `npm run build` command.
    entryPoints: ['./build-browser/index.noDefault.js'],
    bundle: true,
    minify,
    platform: 'browser',
    // https://esbuild.github.io/api/#target
    // target: 'es5',
    sourcemap: true,
    outfile: `build-browser/sequelize${minify ? '.min' : ''}.js`,
    // Can define the names of packages that shouldn't be included in the bundle.
    external: [],
    // Can define env variables here.
    define: {},
    // The global variable name.
    globalName: 'Sequelize',
    plugins: aliases.map(alias),
    // Can replace global variables with "shims".
    // https://esbuild.github.io/api/#inject
    inject: [
      resolve(__dirname, './esbuild.globals.js'),
    ],
  });
}

function alias({ include, exclude, packages }) {
  return aliasPlugin({
    include: include && resolvePaths(include),
    exclude: exclude && resolvePaths(exclude),
    packages: Object.fromEntries(
      Object.keys(packages).map(packageName => [
        packageName, // key
        getShimPath(packages[packageName]), // value
      ]),
    ),
  });
}

function resolvePaths(paths) {
  return getFilePathsInLib(paths).map(path => resolve(__dirname, '..', path));
}

// A fork of `esbuild-plugin-alias` whose github repository was deleted.
// https://unpkg.com/browse/esbuild-plugin-alias@0.2.1/
// Added `include` option.
function aliasPlugin({ include, exclude, packages }) {
  const regExp = new RegExp(`^(${Object.keys(packages).map(escapeRegExp).join('|')})$`);

  return {
    name: 'alias',
    setup(build_) {
      // "we do not register 'file' namespace here, because the root file won't be processed"
      // https://github.com/evanw/esbuild/issues/791
      // What?
      //
      // https://esbuild.github.io/plugins/#on-resolve-options
      // https://esbuild.github.io/plugins/#on-resolve-arguments
      //
      build_.onResolve({ filter: regExp }, args => {
        if (include && !include.some(getPathMatcher(args.importer))) {
          return;
        }

        if (exclude && exclude.some(getPathMatcher(args.importer))) {
          return;
        }

        // https://esbuild.github.io/plugins/#on-resolve-results
        // eslint-disable-next-line consistent-return
        return {
          path: packages[args.path],
        };
      });
    },
  };
}

function escapeRegExp(string) {
  // $& means the whole matched string
  return string.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPathMatcher(string) {
  return path => {
    if (string === path) {
      return true;
    }

    if (string.indexOf(path) === 0) {
      if (string[path.length + 1] === '/') {
        return true;
      }

      return false;
    }

    return false;
  };
}

function getFilePathsInLib(filePaths) {
  return filePaths.map(filePath => {
    return filePath.replace('./src', './lib').replace(/\.ts$/, '.js');
  });
}

function getShimPath(shimName) {
  const importPath = `./shims/${shimName}/index.js`;

  return resolve(__dirname, importPath);
}
