import { bold, cyan, dim } from 'ansis';
import { makeUmzugLogger, SequelizeCommand } from '../../_internal/sequelize-command.js';
import type { MigrationStatus } from '../../api/get-migration-status.js';
import { getMigrationStatus } from '../../api/get-migration-status.js';

export class MigrationStatusCommand extends SequelizeCommand<
  (typeof MigrationStatusCommand)['flags']
> {
  static enableJsonFlag = true;

  static flags = {};

  static summary = 'Shows the status of all database migrations';

  static examples = [
    `<%= config.bin %> <%= command.id %>`,
    `<%= config.bin %> <%= command.id %> --json`,
  ];

  async run(): Promise<{ executed: string[]; pending: string[] }> {
    // eslint-disable-next-line no-console -- temporary for workflow debug
    console.dir('running migration:status command');

    const status: MigrationStatus = await getMigrationStatus({ logger: makeUmzugLogger(this) });

    // eslint-disable-next-line no-console -- temporary for workflow debug
    console.dir({ status }, { depth: null });

    if (status.executed.length === 0 && status.pending.length === 0) {
      this.log('No migrations found.');
    } else {
      if (status.executed.length > 0) {
        this.log(bold('\nExecuted migrations:'));
        for (const migration of status.executed) {
          this.log(`  ${cyan('✔')} ${migration.name}`);
        }
      } else {
        this.log(dim('\nNo migrations have been executed yet.'));
      }

      if (status.pending.length > 0) {
        this.log(bold('\nPending migrations:'));
        for (const migration of status.pending) {
          this.log(`  ${dim('○')} ${migration.name}`);
        }
      } else {
        this.log(dim('\nNo pending migrations.'));
      }
    }

    // eslint-disable-next-line no-console -- temporary for workflow debug
    console.dir('finished command');
    // eslint-disable-next-line no-console -- temporary for workflow debug
    console.dir(
      {
        output: {
          executed: status.executed.map(m => m.name),
          pending: status.pending.map(m => m.name),
        },
      },
      { depth: null },
    );

    return {
      executed: status.executed.map(m => m.name),
      pending: status.pending.map(m => m.name),
    };
  }
}
