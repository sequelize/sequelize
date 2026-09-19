import { expect } from 'chai';
import * as path from 'node:path';
import { resolveProjectFolder } from './utils.js';

describe('resolveProjectFolder', () => {
  const projectRoot = path.join(path.sep, 'home', 'me', 'project');
  const absoluteRoot = path.resolve(projectRoot);

  it('accepts the default option values', () => {
    // These are the defaults of "migrationFolder" & "seedFolder". They start with a separator but
    // are still project-relative: resolving them with path.resolve instead of path.join would
    // discard the project root entirely and make even the default config fail.
    expect(resolveProjectFolder(projectRoot, '/migrations')).to.equal(
      path.join(absoluteRoot, 'migrations'),
    );
    expect(resolveProjectFolder(projectRoot, '/seeds')).to.equal(path.join(absoluteRoot, 'seeds'));
  });

  it('accepts folders nested in the project', () => {
    expect(resolveProjectFolder(projectRoot, 'db/migrations')).to.equal(
      path.join(absoluteRoot, 'db', 'migrations'),
    );
    expect(resolveProjectFolder(projectRoot, './migrations')).to.equal(
      path.join(absoluteRoot, 'migrations'),
    );
    expect(resolveProjectFolder(projectRoot, 'db/../migrations')).to.equal(
      path.join(absoluteRoot, 'migrations'),
    );
  });

  it('accepts the project root itself', () => {
    expect(resolveProjectFolder(projectRoot, '')).to.equal(absoluteRoot);
    expect(resolveProjectFolder(projectRoot, '.')).to.equal(absoluteRoot);
  });

  it('rejects folders that traverse out of the project', () => {
    expect(resolveProjectFolder(projectRoot, '../../../../etc/cron.d')).to.equal(null);
    expect(resolveProjectFolder(projectRoot, 'migrations/../../../etc/cron.d')).to.equal(null);
    expect(resolveProjectFolder(projectRoot, '/../../../etc/cron.d')).to.equal(null);
  });

  it('rejects the parent directory of the project', () => {
    expect(resolveProjectFolder(projectRoot, '..')).to.equal(null);
  });

  it('rejects sibling directories whose name starts with the project name', () => {
    // Guards against a prefix comparison that ignores the path separator: "/home/me/project-evil"
    // starts with "/home/me/project" but is not inside of it.
    expect(resolveProjectFolder(projectRoot, '../project-evil')).to.equal(null);
    expect(resolveProjectFolder(projectRoot, '../project-evil/migrations')).to.equal(null);
  });

  it('treats absolute-looking values as project-relative', () => {
    // Pre-existing behavior, kept for backwards compatibility: because the option values are joined
    // with the project root, a leading separator does not escape the project.
    expect(resolveProjectFolder(projectRoot, '/etc/cron.d')).to.equal(
      path.join(absoluteRoot, 'etc', 'cron.d'),
    );
  });
});
