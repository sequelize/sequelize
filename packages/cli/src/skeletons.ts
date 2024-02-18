import * as path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const SKELETONS_FOLDER = path.join(__dirname, 'skeletons');
