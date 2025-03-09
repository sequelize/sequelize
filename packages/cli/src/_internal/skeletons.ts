import { fileUrlToDirname } from '@sequelize/utils/node';
import * as path from 'node:path';

const __dirname = fileUrlToDirname(import.meta.url);

export const SKELETONS_FOLDER = path.join(__dirname, '..', '..', 'static', 'skeletons');
