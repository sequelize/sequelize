import { Flags } from '@oclif/core';
import { green } from 'ansis';
import { makeUmzugLogger, SequelizeCommand } from '../../_internal/sequelize-command.js';
import type { RunMigrationsOptions } from '../../api/run-migrations.js';
import { runMigrations } from '../../api/run-migrations.js';

export class RunMigrations extends SequelizeCommand<(typeof RunMigrations)['flags']> {
  static enableJsonFlag = true;

  static flags = {
    to: Flags.string({
      summary: 'Run migrations up to and including this migration name',
    }),
    step: Flags.integer({
      summary: 'Run only this many pending migrations',
    }),
  };

  static summary = 'Runs pending database migrations';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --to=20240101000000-create-users`,
    `<%= config.bin %> <%= command.id %> --step=1`,
  ];

  async run(): Promise<{ count: number; migrations: string[] }> {
    const { to, step } = this.flags;

    const opts: RunMigrationsOptions = { logger: makeUmzugLogger(this) };
    if (to != null) {
      opts.to = to;
    }

    if (step != null) {
      opts.step = step;
    }

    const executed = await runMigrations(opts);

    if (executed.length === 0) {
      this.log('No pending migrations to run.');
    } else {
      this.log(`Successfully ran ${executed.length} migration(s).`);
      for (const migration of executed) {
        this.log(`  ${green('✔')} ${migration.name}`);
      }
    }

    return { count: executed.length, migrations: executed.map(m => m.name) };
  }
}
