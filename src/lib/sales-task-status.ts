import type { AppSalesTaskStatus } from '@prisma/client';
import type { SalesTaskStatus } from '@/types/sales-task';

const UI_TO_DB_STATUS: Record<SalesTaskStatus, AppSalesTaskStatus> = {
  MAIL: 'MEET',
  PHONE: 'CONTACT_BY_PHONE',
  MEETING: 'MEETING_DATE',
  CONTRACT: 'CONTRACT',
};

export function toDbSalesTaskStatus(status: SalesTaskStatus): AppSalesTaskStatus {
  return UI_TO_DB_STATUS[status];
}

export function fromDbSalesTaskStatus(
  status?: AppSalesTaskStatus | string | null,
): SalesTaskStatus {
  switch (status) {
    case 'MEET':
      return 'MAIL';
    case 'CONTACT_BY_PHONE':
      return 'PHONE';
    case 'MEETING_DATE':
      return 'MEETING';
    case 'GIVE_INFO':
      return 'MEETING';
    case 'CONTRACT':
      return 'CONTRACT';
    default:
      return 'MAIL';
  }
}
