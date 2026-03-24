import type { ProcessDefinition } from './types';
import { businessAnalysisProcess } from './businessAnalysisProcess';
import { criticalUpdateReleaseProcess } from './criticalUpdateRelease';
import { serviceRolloutProcess } from './serviceRollout';

export const processCatalog: ProcessDefinition[] = [
  businessAnalysisProcess,
  criticalUpdateReleaseProcess,
  serviceRolloutProcess,
];

export const defaultProcessId = criticalUpdateReleaseProcess.id;