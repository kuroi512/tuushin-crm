import {
  SALES_TASK_STAGE_ORDER,
  type SalesTaskProgress,
  type SalesTaskStageProgress,
  type SalesTaskStatus,
} from '@/types/sales-task';

const STAGE_INDEX = new Map<SalesTaskStatus, number>(
  SALES_TASK_STAGE_ORDER.map((stage, index) => [stage, index]),
);

function emptyStage(): SalesTaskStageProgress {
  return {
    completed: false,
    completedAt: null,
    completedByName: null,
    completedByEmail: null,
  };
}

export function createEmptySalesTaskProgress(): SalesTaskProgress {
  return SALES_TASK_STAGE_ORDER.reduce<SalesTaskProgress>((acc, stage) => {
    acc[stage] = emptyStage();
    return acc;
  }, {} as SalesTaskProgress);
}

export function ensureSalesTaskProgress(progress: unknown): SalesTaskProgress {
  const base = createEmptySalesTaskProgress();
  if (!progress || typeof progress !== 'object') {
    return base;
  }

  const raw = progress as Record<string, unknown>;
  for (const stage of SALES_TASK_STAGE_ORDER) {
    const value = raw?.[stage];
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;

    base[stage] = {
      completed: record.completed === true,
      completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
      completedByName:
        typeof record.completedByName === 'string' ? (record.completedByName as string) : null,
      completedByEmail:
        typeof record.completedByEmail === 'string' ? (record.completedByEmail as string) : null,
    };
  }

  return base;
}

export function applyStatusToSalesTaskProgress(
  progress: unknown,
  status: SalesTaskStatus,
  meta?: { userName?: string | null; userEmail?: string | null; at?: Date },
): SalesTaskProgress {
  const snapshot = ensureSalesTaskProgress(progress);
  const next = SALES_TASK_STAGE_ORDER.reduce<SalesTaskProgress>((acc, stage) => {
    acc[stage] = { ...snapshot[stage] };
    return acc;
  }, {} as SalesTaskProgress);

  const targetIndex = STAGE_INDEX.get(status) ?? 0;
  const timestamp = (meta?.at ?? new Date()).toISOString();
  const userName = meta?.userName ?? null;
  const userEmail = meta?.userEmail ?? null;

  for (const stage of SALES_TASK_STAGE_ORDER) {
    const index = STAGE_INDEX.get(stage) ?? 0;
    const existing = next[stage];

    if (index < targetIndex) {
      if (!existing.completed) {
        next[stage] = {
          completed: true,
          completedAt: timestamp,
          completedByName: userName,
          completedByEmail: userEmail,
        };
      }
      continue;
    }

    if (index === targetIndex) {
      next[stage] = {
        completed: true,
        completedAt: timestamp,
        completedByName: userName,
        completedByEmail: userEmail,
      };
      continue;
    }

    next[stage] = emptyStage();
  }

  return next;
}
