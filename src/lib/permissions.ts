export type AppRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'UNKNOWN';

const normalize = (role?: string | null): AppRole => {
  if (!role) return 'UNKNOWN';
  const upper = role.toUpperCase();
  if (upper === 'ADMIN' || upper === 'MANAGER' || upper === 'SALES') {
    return upper as AppRole;
  }
  return 'UNKNOWN';
};

const PERMISSION_MATRIX = {
  viewUsers: ['ADMIN', 'MANAGER'],
  manageUsers: ['ADMIN', 'MANAGER'],
  deleteUsers: ['ADMIN'],
  manageCompanySettings: ['ADMIN', 'MANAGER'],
  accessReports: ['ADMIN', 'MANAGER'],
  accessMasterData: ['ADMIN', 'MANAGER'],
  accessQuotations: ['ADMIN', 'MANAGER', 'SALES'],
  accessSalesTasks: ['ADMIN', 'MANAGER', 'SALES'],
  accessDashboard: ['ADMIN', 'MANAGER', 'SALES'],
  viewAllQuotations: ['ADMIN', 'MANAGER'],
  manageQuotations: ['ADMIN', 'MANAGER', 'SALES'],
  viewAllSalesTasks: ['ADMIN', 'MANAGER'],
  manageSalesTasks: ['ADMIN', 'MANAGER', 'SALES'],
} as const satisfies Record<string, AppRole[]>;

export type PermissionKey = keyof typeof PERMISSION_MATRIX;

export const hasPermission = (role: string | null | undefined, permission: PermissionKey) => {
  const normalized = normalize(role);
  const allowed = PERMISSION_MATRIX[permission] as AppRole[];
  return allowed ? allowed.includes(normalized) : false;
};

export const isAdminRole = (role?: string | null) => {
  const normalized = normalize(role);
  return normalized === 'ADMIN';
};

export const isSalesRole = (role?: string | null) => normalize(role) === 'SALES';

export const isManagerRole = (role?: string | null) => normalize(role) === 'MANAGER';

export const normalizeRole = normalize;
