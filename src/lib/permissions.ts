export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'SALES' | 'USER' | 'UNKNOWN';

const normalize = (role?: string | null): AppRole => {
  if (!role) return 'UNKNOWN';
  const upper = role.toUpperCase();
  if (
    upper === 'SUPER_ADMIN' ||
    upper === 'ADMIN' ||
    upper === 'MANAGER' ||
    upper === 'SALES' ||
    upper === 'USER'
  ) {
    return upper as AppRole;
  }
  return 'UNKNOWN';
};

const PERMISSION_MATRIX = {
  viewUsers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  manageUsers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  manageCompanySettings: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  manageQuotationRules: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  accessReports: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  accessMasterData: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  accessQuotations: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'USER'],
  accessSalesTasks: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'],
  accessDashboard: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'USER'],
  viewAllQuotations: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  manageQuotations: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'],
  viewAllSalesTasks: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  manageSalesTasks: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES'],
} as const satisfies Record<string, AppRole[]>;

export type PermissionKey = keyof typeof PERMISSION_MATRIX;

export const hasPermission = (role: string | null | undefined, permission: PermissionKey) => {
  const normalized = normalize(role);
  if (normalized === 'SUPER_ADMIN') return true; // super admin always allowed
  const allowed = PERMISSION_MATRIX[permission] as AppRole[];
  return allowed ? allowed.includes(normalized) : false;
};

export const isAdminRole = (role?: string | null) => {
  const normalized = normalize(role);
  return normalized === 'SUPER_ADMIN' || normalized === 'ADMIN';
};

export const isSalesRole = (role?: string | null) => normalize(role) === 'SALES';

export const isManagerRole = (role?: string | null) => normalize(role) === 'MANAGER';

export const normalizeRole = normalize;
