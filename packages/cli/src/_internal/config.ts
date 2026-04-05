import { cosmiconfig } from 'cosmiconfig';
import * as path from 'node:path';
import { z } from 'zod/v3';

const explorer = cosmiconfig('sequelize');
const result = await explorer.search();

const projectRoot = result?.filepath ? path.dirname(result.filepath) : process.cwd();

const configSchema = z.object({
  migrationFolder: z
    .string()
    .default('/migrations')
    .transform(val => path.join(projectRoot, val)),
  seedFolder: z
    .string()
    .default('/seeds')
    .transform(val => path.join(projectRoot, val)),
});

export const config = configSchema.parse(result?.config || {});
