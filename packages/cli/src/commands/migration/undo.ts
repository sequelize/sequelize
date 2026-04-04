import { Flags } from '@oclif/core';
import { yellow } from 'ansis';
import { makeUmzugLogger, SequelizeCommand } from '../../_internal/sequelize-command.js';
import type { UndoMigrationsOptions } from '../../api/undo-migrations.js';
import { undoMigrations } from '../../api/undo-migrations.js';

export class UndoMigration extends SequelizeCommand<(typeof UndoMigration)['flags']> {
  static enableJsonFlag = true;

  static flags = {
    all: Flags.boolean({
      summary: 'Revert all executed migrations',
      default: false,
    }),
    to: Flags.string({
      summary:
        'Revert migrations down to and including this migration name. Implies --all when specified.',
      exclusive: ['step'],
    }),
    step: Flags.integer({
      summary: 'Number of migrations to revert (default: 1)',
      default: 1,
      exclusive: ['all', 'to'],
    }),
  };

  static summary = 'Reverts executed database migration(s)';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --step=3`,
    `<%= config.bin %> <%= command.id %> --all`,
    `<%= config.bin %> <%= command.id %> --to=20240101000000-create-users`,
  ];

  async run(): Promise<{ count: number; migrations: string[] }> {
    const { all, to, step } = this.flags;

    const opts: UndoMigrationsOptions = { logger: makeUmzugLogger(this) };
    if (to != null) {
      opts.to = to;
    } else if (all) {
      opts.to = 0;
    } else {
      opts.step = step;
    }

    const reverted = await undoMigrations(opts);

    if (reverted.length === 0) {
      this.log('No executed migrations to revert.');
    } else {
      this.log(`Successfully reverted ${reverted.length} migration(s).`);
      for (const migration of reverted) {
        this.log(`  ${yellow('✔')} ${migration.name}`);
      }
    }

    return { count: reverted.length, migrations: reverted.map(m => m.name) };
  }
}
