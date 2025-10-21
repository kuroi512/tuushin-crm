export const SALES_TASK_STAGE_ORDER = [
  'MEET',
  'CONTACT_BY_PHONE',
  'MEETING_DATE',
  'GIVE_INFO',
  'CONTRACT',
] as const;

export type SalesTaskStatus = (typeof SALES_TASK_STAGE_ORDER)[number];
export interface SalesTaskStageProgress {
  completed: boolean;
  completedAt?: string | null;
  completedByName?: string | null;
  completedByEmail?: string | null;
}

export type SalesTaskProgress = Record<SalesTaskStatus, SalesTaskStageProgress>;

export interface SalesTaskStatusLog {
  id: string;
  status: SalesTaskStatus;
  completed: boolean;
  comment?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
}

export interface SalesTask {
  id: string;
  title?: string | null;
  meetingDate?: string | null;
  clientName: string;
  salesManagerId?: string | null;
  salesManagerName?: string | null;
  originCountry?: string | null;
  destinationCountry?: string | null;
  commodity?: string | null;
  mainComment?: string | null;
  status: SalesTaskStatus;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: string;
  updatedAt: string;
  progress?: SalesTaskProgress;
  statusLogs?: SalesTaskStatusLog[];
}
