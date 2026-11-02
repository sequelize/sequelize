#!/usr/bin/env node

import { execute } from '@oclif/core';
import { exitAfterGracePeriod } from '../lib/_internal/exit-grace-period.js';

await execute({ dir: import.meta.url });

exitAfterGracePeriod();
