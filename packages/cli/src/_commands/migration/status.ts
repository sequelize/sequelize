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

  async run(): Promise<{ migrated: string[]; pending: string[] }> {
    const status: MigrationStatus = await getMigrationStatus({ logger: makeUmzugLogger(this) });

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

    return {
      migrated: status.executed.map(m => m.name),
      pending: status.pending.map(m => m.name),
    };
  }
}
