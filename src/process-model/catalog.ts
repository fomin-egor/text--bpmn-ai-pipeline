import type { ProcessDefinition } from './types';
import { criticalUpdateReleaseProcess } from './criticalUpdateRelease';
import { serviceRolloutProcess } from './serviceRollout';

export const processCatalog: ProcessDefinition[] = [
  criticalUpdateReleaseProcess,
  serviceRolloutProcess,
];

export const defaultProcessId = criticalUpdateReleaseProcess.id;