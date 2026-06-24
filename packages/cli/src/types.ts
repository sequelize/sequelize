import type { UmzugContext } from './api/get-umzug.js';

export type MigrationFunction = (context: UmzugContext) => Promise<void>;
