'use client';

import { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ComboBox } from '@/components/ui/combobox';
import { toast } from 'sonner';
import { keepPreviousData } from '@tanstack/react-query';
import {
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  RefreshCcw,
  Check,
  Circle,
  Mail,
  Phone,
  CalendarCheck,
  FileSignature,
} from 'lucide-react';
import { format } from 'date-fns';
import { hasPermission, normalizeRole } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { ensureSalesTaskProgress } from '@/lib/sales-task-progress';
import {
  SALES_TASK_STAGE_ORDER,
  type SalesTask,
  type SalesTaskStatus,
  type SalesTaskStatusLog,
  type SalesTaskProgress,
} from '@/types/sales-task';
import { useLookup } from '@/components/lookup/hooks';

const STATUS_LABELS: Record<SalesTaskStatus, string> = {
  MAIL: 'Mail',
  PHONE: 'Phone',
  MEETING: 'Meeting',
  CONTRACT: 'Contract',
};

const STATUS_ICONS: Record<SalesTaskStatus, any> = {
  MAIL: Mail,
  PHONE: Phone,
  MEETING: CalendarCheck,
  CONTRACT: FileSignature,
};

const STATUS_BADGE_VARIANT: Record<SalesTaskStatus, string> = {
  MAIL: 'secondary',
  PHONE: 'outline',
  MEETING: 'default',
  CONTRACT: 'default',
};

const DEFAULT_STAGE = SALES_TASK_STAGE_ORDER[0];

type SalesTaskResponse = {
  success: boolean;
  data: SalesTask[];
  pagination?: { page: number; pageSize: number; total: number };
};

type CreateFormState = {
  title: string;
  clientName: string;
  salesManagerId: string;
  salesManagerName: string;
  mainComment: string;
  statuses: SalesTaskStatus[];
};

const INITIAL_FORM: CreateFormState = {
  title: '',
  clientName: '',
  salesManagerId: '',
  salesManagerName: '',
  mainComment: '',
  statuses: [DEFAULT_STAGE],
};

const PAGE_SIZE = 15;

type StageSelectorProps = {
  value: SalesTaskStatus;
  onChange: (value: SalesTaskStatus) => void;
  progress?: SalesTaskProgress | null;
  disabled?: boolean;
  className?: string;
};

type MultiStageSelectorProps = {
  values: SalesTaskStatus[];
  onToggle: (value: SalesTaskStatus) => void;
  disabled?: boolean;
  className?: string;
};

function MultiStageSelector({ values, onToggle, disabled, className }: MultiStageSelectorProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {SALES_TASK_STAGE_ORDER.map((stage) => {
        const isActive = values.includes(stage);
        const Icon = STATUS_ICONS[stage];
        return (
          <button
            key={stage}
            type="button"
            onClick={() => {
              if (!disabled) onToggle(stage);
            }}
            disabled={disabled}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition',
              disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/60 cursor-pointer',
              isActive
                ? 'border-primary bg-primary/10 text-primary ring-primary/40 shadow-sm ring-2'
                : 'border-muted bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="font-medium">{STATUS_LABELS[stage]}</span>
            {isActive ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}

function StageSelector({ value, onChange, progress, disabled, className }: StageSelectorProps) {
  const normalized = useMemo(() => ensureSalesTaskProgress(progress), [progress]);

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {SALES_TASK_STAGE_ORDER.map((stage) => {
        const stageProgress = normalized[stage];
        const isActive = stage === value;
        const showAsComplete = stageProgress?.completed || isActive;
        const buttonClass = cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/60',
          isActive
            ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/40'
            : showAsComplete
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-muted bg-muted text-muted-foreground',
        );

        return (
          <button
            key={stage}
            type="button"
            onClick={() => {
              if (!disabled) onChange(stage);
            }}
            disabled={disabled}
            className={buttonClass}
            aria-pressed={isActive}
          >
            {(() => {
              const Icon = STATUS_ICONS[stage];
              return <Icon className="h-4 w-4" />;
            })()}
            <span className="font-medium">{STATUS_LABELS[stage]}</span>
            {showAsComplete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}

export default function SalesTasksPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const role = normalizeRole(session?.user?.role);
  const canManage = hasPermission(role, 'manageSalesTasks');

  const [statusFilter, setStatusFilter] = useState<SalesTaskStatus[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const deferredSearch = useDeferredValue(searchValue.trim());
  const [pageInput, setPageInput] = useState('1');
  const [salesManagerFilter, setSalesManagerFilter] = useState<string>('');
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page') ?? '1');
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<CreateFormState>({ ...INITIAL_FORM });
  const [statusModalTask, setStatusModalTask] = useState<SalesTask | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SalesTaskStatus>(DEFAULT_STAGE);

  useEffect(() => {
    const searchParam = searchParams.get('search') ?? '';
    setSearchValue((prev) => (prev === searchParam ? prev : searchParam));
  }, [searchParams]);

  useEffect(() => {
    const statusParam = (searchParams.get('status') || '').toUpperCase();
    const statuses = statusParam
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry): entry is SalesTaskStatus =>
        SALES_TASK_STAGE_ORDER.includes(entry as SalesTaskStatus),
      );
    setStatusFilter((prev) => {
      if (
        prev.length === statuses.length &&
        prev.every((value, index) => value === statuses[index])
      ) {
        return prev;
      }
      return statuses;
    });
  }, [searchParams]);

  useEffect(() => {
    const pageParam = Number(searchParams.get('page') ?? '1');
    const normalized = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    setPage((prev) => (prev === normalized ? prev : normalized));
  }, [searchParams]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    const salesManagerParam = searchParams.get('salesManagerId') ?? '';
    setSalesManagerFilter(salesManagerParam);
  }, [searchParams]);

  const { data: customersLookup, isLoading: customersLoading } = useLookup('customer');

  // Fetch all active users from User table for assignment/filter selectors
  const salesManagersQuery = useQuery<{
    success: boolean;
    data: Array<{ id: string; name: string | null; email: string; role: string }>;
  }>({
    queryKey: ['sales-managers'],
    queryFn: async () => {
      const res = await fetch('/api/users/sales-managers', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load users');
      }
      return res.json();
    },
  });

  const customerOptions = useMemo(() => {
    const options = (customersLookup?.data || [])
      .map((c) => c.name)
      .filter((name): name is string => Boolean(name));
    return options.length ? options : [];
  }, [customersLookup?.data]);

  const salesOptions = useMemo(() => {
    const users = salesManagersQuery.data?.data || [];
    return users.map((user) => ({
      id: user.id,
      name: user.name || user.email || 'Unknown',
    }));
  }, [salesManagersQuery.data?.data]);

  const autoSelectedSalesManager = useMemo(() => {
    const users = salesManagersQuery.data?.data || [];
    const sessionUserId = session?.user?.id || '';
    const sessionEmail = (session?.user?.email || '').trim().toLowerCase();

    const matchById = sessionUserId ? users.find((user) => user.id === sessionUserId) : null;
    if (matchById) {
      return {
        id: matchById.id,
        name: matchById.name || matchById.email || '',
      };
    }

    const matchByEmail = sessionEmail
      ? users.find((user) => (user.email || '').trim().toLowerCase() === sessionEmail)
      : null;
    if (matchByEmail) {
      return {
        id: matchByEmail.id,
        name: matchByEmail.name || matchByEmail.email || '',
      };
    }

    const fallbackName = session?.user?.name || session?.user?.email || '';
    if (!fallbackName) return null;

    return {
      id: sessionUserId,
      name: fallbackName,
    };
  }, [salesManagersQuery.data?.data, session?.user?.email, session?.user?.id, session?.user?.name]);

  const salesIndex = useMemo(() => {
    const idx = new Map<string, string>();
    salesOptions.forEach((opt) => idx.set(opt.id, opt.name));
    return idx;
  }, [salesOptions]);

  const tasksQuery = useQuery<SalesTaskResponse>({
    queryKey: [
      'sales-tasks',
      {
        page,
        pageSize: PAGE_SIZE,
        search: deferredSearch || undefined,
        status: statusFilter.length ? statusFilter.join(',') : undefined,
        salesManagerId: salesManagerFilter || undefined,
      },
    ],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(PAGE_SIZE));
      if (deferredSearch) qs.set('search', deferredSearch);
      if (statusFilter.length) qs.set('status', statusFilter.join(','));
      if (salesManagerFilter) qs.set('salesManagerId', salesManagerFilter);
      const res = await fetch(`/api/sales-tasks?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to load sales tasks');
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const { data: tasksResponse, isLoading, isFetching, isError, error } = tasksQuery;
  const tasks = tasksResponse?.data || [];
  const pagination = tasksResponse?.pagination;
  const totalRows = pagination?.total ?? tasks.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / (pagination?.pageSize ?? PAGE_SIZE)));

  useEffect(() => {
    if (!isError || !(error instanceof Error)) return;
    toast.error(error.message);
  }, [isError, error]);

  const resetForm = useCallback(() => {
    setForm({ ...INITIAL_FORM });
  }, []);

  const closeCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (!showCreateModal || !autoSelectedSalesManager) return;

    setForm((prev) => {
      const hasSalesManagerId = prev.salesManagerId.trim().length > 0;
      const hasSalesManagerName = prev.salesManagerName.trim().length > 0;
      if (hasSalesManagerId || hasSalesManagerName) return prev;

      return {
        ...prev,
        salesManagerId: autoSelectedSalesManager.id,
        salesManagerName: autoSelectedSalesManager.name,
      };
    });
  }, [autoSelectedSalesManager, showCreateModal]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim() || undefined,
        clientName: form.clientName.trim(),
        salesManagerId: form.salesManagerId || undefined,
        salesManagerName: form.salesManagerName || undefined,
        mainComment: form.mainComment.trim() || undefined,
        statuses: form.statuses,
      };
      const res = await fetch('/api/sales-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to create sales task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Sales task created');
      queryClient.invalidateQueries({ queryKey: ['sales-tasks'] });
      closeCreateModal();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create sales task');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to delete task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Sales task deleted');
      queryClient.invalidateQueries({ queryKey: ['sales-tasks'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete task'),
  });

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: SalesTaskStatus; comment: string }) => {
      const res = await fetch(`/api/sales-tasks/${input.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status, comment: input.comment || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: (result, variables) => {
      toast.success('Status updated');
      setStatusModalTask((prev) =>
        prev
          ? {
              ...prev,
              status:
                (result?.data?.task?.status as SalesTaskStatus | undefined) || variables.status,
              progress: result?.data?.task?.progress || prev.progress,
              updatedAt: result?.data?.task?.updatedAt || prev.updatedAt,
            }
          : prev,
      );
      setStatusComment('');
      queryClient.invalidateQueries({ queryKey: ['sales-tasks'] });
      if (statusModalTask) {
        queryClient.invalidateQueries({ queryKey: ['sales-task-status-log', statusModalTask.id] });
      }
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const statusLogsQuery = useQuery<{ success: boolean; data: SalesTaskStatusLog[] }>({
    queryKey: ['sales-task-status-log', statusModalTask?.id],
    queryFn: async () => {
      if (!statusModalTask) throw new Error('Missing task id');
      const res = await fetch(`/api/sales-tasks/${statusModalTask.id}/status`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error || 'Failed to load status log');
      }
      return res.json();
    },
    enabled: Boolean(statusModalTask?.id),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!statusModalTask) {
      setStatusComment('');
      setSelectedStatus(DEFAULT_STAGE);
    } else {
      setSelectedStatus(statusModalTask.status);
      setStatusComment('');
    }
  }, [statusModalTask]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('search', value);
      else params.delete('search');
      params.set('page', '1');
      setPage(1);
      router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
    },
    [router, searchParams],
  );

  const handleSalesManagerFilterChange = useCallback(
    (value: string) => {
      // Treat "all" as clearing the filter
      const actualValue = value === 'all' ? '' : value;
      setSalesManagerFilter(actualValue);
      const params = new URLSearchParams(searchParams.toString());
      if (actualValue) params.set('salesManagerId', actualValue);
      else params.delete('salesManagerId');
      params.set('page', '1');
      setPage(1);
      router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
    },
    [router, searchParams],
  );

  const toggleStatusFilter = useCallback(
    (status: SalesTaskStatus) => {
      const next = statusFilter.includes(status)
        ? statusFilter.filter((entry) => entry !== status)
        : [...statusFilter, status];
      setStatusFilter(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next.length) params.set('status', next.join(','));
      else params.delete('status');
      params.set('page', '1');
      setPage(1);
      router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
    },
    [router, searchParams, statusFilter],
  );

  const clearStatusFilters = useCallback(() => {
    setStatusFilter([]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('status');
    params.set('page', '1');
    setPage(1);
    router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
  }, [router, searchParams]);

  const handlePageChange = useCallback(
    (next: number) => {
      const normalized = Math.min(Math.max(1, next), totalPages || 1);
      if (normalized === page) return;
      setPage(normalized);
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(normalized));
      router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
    },
    [page, router, searchParams, totalPages],
  );

  const columns = useMemo<ColumnDef<SalesTask, unknown>[]>(
    () => [
      {
        accessorKey: 'clientName',
        header: 'Client',
        cell: ({ row }) => <span className="font-medium">{row.original.clientName}</span>,
      },
      {
        accessorKey: 'salesManagerName',
        header: 'Sales manager',
        cell: ({ row }) => row.original.salesManagerName || '—',
      },
      {
        accessorKey: 'mainComment',
        header: 'Main comment',
        cell: ({ row }) => (
          <span className="text-muted-foreground line-clamp-2">
            {row.original.mainComment || '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant={STATUS_BADGE_VARIANT[status] as any}>{STATUS_LABELS[status]}</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusModalTask(row.original)}
              disabled={!canManage}
            >
              <History className="mr-2 h-4 w-4" /> Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteMutation.mutate(row.original.id)}
              disabled={!canManage || deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        ),
      },
    ],
    [canManage, deleteMutation],
  );

  const handleSubmitCreate = () => {
    const missing: string[] = [];
    if (!form.clientName.trim()) missing.push('Client');
    if (!form.salesManagerName.trim()) missing.push('Sales manager');
    if (!form.mainComment.trim()) missing.push('Main comment');
    if (!form.statuses.length) missing.push('At least one stage');

    if (missing.length) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return;
    }

    createMutation.mutate();
  };

  const statusLogs = statusLogsQuery.data?.data ?? [];

  const showSkeleton = isLoading && !tasks.length;
  const showEmptyState = !isLoading && tasks.length === 0;

  return (
    <>
      <div className="space-y-1.5 px-2 sm:px-4 md:space-y-2 md:px-6">
        <div className="flex flex-col gap-1.5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Sales tasks</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Track sales pipeline actions and follow-up status.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <div className="relative w-full">
              <Input
                id="sales-task-search"
                placeholder="Search by client or manager"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
              <span className="pointer-events-none absolute top-2.5 left-2 text-gray-400">🔎</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter.length === 0 ? 'secondary' : 'outline'}
                size="sm"
                onClick={clearStatusFilters}
                className="flex-1 sm:flex-none"
              >
                All stages
              </Button>
              {SALES_TASK_STAGE_ORDER.map((status) => {
                const isActive = statusFilter.includes(status);
                const Icon = STATUS_ICONS[status];
                return (
                  <Button
                    key={status}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleStatusFilter(status)}
                    className="flex-1 rounded-full sm:flex-none"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {STATUS_LABELS[status]}
                  </Button>
                );
              })}
              <div className="min-w-[180px] flex-1 sm:max-w-xs sm:flex-none">
                <Select
                  value={salesManagerFilter || 'all'}
                  onValueChange={handleSalesManagerFilterChange}
                  disabled={salesOptions.length === 0 && salesManagersQuery.isLoading}
                >
                  <SelectTrigger
                    id="sales-manager-filter"
                    className="w-full"
                    clearable={Boolean(salesManagerFilter)}
                    hasValue={Boolean(salesManagerFilter)}
                    onClear={() => handleSalesManagerFilterChange('all')}
                    clearAriaLabel="Clear sales manager filter"
                  >
                    <SelectValue
                      placeholder={salesManagersQuery.isLoading ? 'Loading…' : 'All managers'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All managers</SelectItem>
                    {salesOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {salesManagerFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSalesManagerFilterChange('all')}
                  className="flex-1 sm:flex-none"
                >
                  Clear filters
                </Button>
              )}
              <Button
                onClick={() => setShowCreateModal(true)}
                disabled={!canManage}
                className="flex w-full items-center justify-center gap-2 sm:ml-auto sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                New task
              </Button>
            </div>
          </div>
          {statusFilter.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span>Filtering by:</span>
              {statusFilter.map((status) => (
                <Badge
                  key={status}
                  variant={STATUS_BADGE_VARIANT[status] as any}
                  className="gap-1 rounded-full px-3 py-1"
                >
                  {STATUS_LABELS[status]}
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearStatusFilters}>
                Clear stages
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg sm:text-xl">All sales tasks</CardTitle>
              <CardDescription className="text-sm">
                {isLoading
                  ? 'Loading sales tasks…'
                  : isFetching
                    ? 'Refreshing…'
                    : 'Review assignments, comments, and stage progress.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isFetching && !isLoading && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['sales-tasks'] })}
                disabled={isLoading}
                className="inline-flex items-center gap-1"
              >
                <RefreshCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-0 sm:p-2">
            {isError && error instanceof Error ? (
              <div className="p-4">
                <Alert variant="destructive" className="gap-y-3">
                  <AlertCircle />
                  <AlertTitle>Could not load sales tasks</AlertTitle>
                  <AlertDescription className="w-full">
                    <p>{error.message}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['sales-tasks'] })}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  {showSkeleton ? (
                    <div className="min-w-[800px] p-4">
                      <SalesTasksTableSkeleton rows={8} />
                    </div>
                  ) : (
                    <div className="min-w-[800px] p-2 sm:p-0">
                      {showEmptyState ? (
                        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center text-sm">
                          <p>No sales tasks found.</p>
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                queryClient.invalidateQueries({ queryKey: ['sales-tasks'] })
                              }
                            >
                              <RefreshCcw className="h-4 w-4" />
                              <span className="ml-1">Refresh</span>
                            </Button>
                            {canManage && (
                              <Button size="sm" onClick={() => setShowCreateModal(true)}>
                                <Plus className="h-4 w-4" />
                                <span className="ml-1">New task</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <DataTable
                          columns={columns}
                          data={tasks}
                          hideBuiltInSearch
                          hideColumnVisibilityMenu
                          enableRowReordering={false}
                          enableColumnReordering={false}
                          enablePagination={false}
                        />
                      )}
                    </div>
                  )}
                </div>
                <div className="text-muted-foreground flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                  <div>
                    {totalRows > 0
                      ? `Total ${totalRows} • Page ${page} / ${totalPages}`
                      : 'No records to display'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(1)}
                      disabled={page <= 1 || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">First</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1 || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Prev</span>
                    </Button>
                    <span className="text-xs font-medium text-gray-600 sm:text-sm">
                      {page} / {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs">Go to</span>
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const target = Number(pageInput || '1');
                          if (!Number.isFinite(target)) return;
                          handlePageChange(target);
                        }}
                        className="h-8 w-16"
                        aria-label="Go to page"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={page >= totalPages || isLoading}
                      className="inline-flex items-center gap-1"
                    >
                      <span className="hidden sm:inline">Last</span>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => (!open ? closeCreateModal() : setShowCreateModal(true))}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create sales task</DialogTitle>
            <DialogDescription>
              Capture meeting context and assign follow-up owner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Short summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-client">Client</Label>
              <ComboBox
                value={form.clientName}
                onChange={(value) => setForm((prev) => ({ ...prev, clientName: value }))}
                options={customerOptions}
                placeholder="Select or type client"
                isLoading={customersLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-sales-manager">Sales manager</Label>
              <Select
                value={form.salesManagerId}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    salesManagerId: value,
                    salesManagerName: salesIndex.get(value) || '',
                  }))
                }
                disabled={salesOptions.length === 0 && salesManagersQuery.isLoading}
              >
                <SelectTrigger
                  id="task-sales-manager"
                  clearable={Boolean(form.salesManagerId)}
                  hasValue={Boolean(form.salesManagerId)}
                  onClear={() =>
                    setForm((prev) => ({
                      ...prev,
                      salesManagerId: '',
                      salesManagerName: '',
                    }))
                  }
                  clearAriaLabel="Clear sales manager"
                >
                  <SelectValue
                    placeholder={salesManagersQuery.isLoading ? 'Loading…' : 'Choose user'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {salesOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Stages</Label>
              <MultiStageSelector
                values={form.statuses}
                onToggle={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    statuses: prev.statuses.includes(value)
                      ? prev.statuses.filter((entry) => entry !== value)
                      : [...prev.statuses, value],
                  }))
                }
                disabled={createMutation.isPending}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="task-main-comment">Main comment</Label>
              <Textarea
                id="task-main-comment"
                value={form.mainComment}
                onChange={(e) => setForm((prev) => ({ ...prev, mainComment: e.target.value }))}
                placeholder="Key notes from meeting"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCreateModal}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(statusModalTask)}
        onOpenChange={(open) => (!open ? setStatusModalTask(null) : null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update status</DialogTitle>
            <DialogDescription>
              Adjust the follow-up stage and leave a brief note. Previous updates keep a timestamped
              trail.
            </DialogDescription>
          </DialogHeader>
          {statusModalTask && (
            <div className="space-y-4">
              <div className="rounded-md border p-4 text-sm">
                <div className="font-semibold">{statusModalTask.clientName}</div>
                <div className="text-muted-foreground">
                  {statusModalTask.salesManagerName || 'Unassigned'} ·{' '}
                  {STATUS_LABELS[statusModalTask.status]}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Stage</Label>
                <StageSelector
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  progress={statusModalTask.progress}
                  disabled={statusMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-comment">Comment</Label>
                <Textarea
                  id="status-comment"
                  placeholder="Update summary"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="mb-0">History</Label>
                  {statusLogsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
                <div className="max-h-48 space-y-3 overflow-y-auto rounded-md border p-3 text-sm">
                  {statusLogs.length === 0 && (
                    <p className="text-muted-foreground">No updates yet.</p>
                  )}
                  {statusLogs.map((log) => (
                    <div key={log.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between">
                        <Badge variant={STATUS_BADGE_VARIANT[log.status] as any}>
                          {STATUS_LABELS[log.status]}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                      {log.comment && <p className="mt-2 text-sm">{log.comment}</p>}
                      <p className="text-muted-foreground mt-1 text-xs">
                        {log.createdByName || log.createdByEmail || 'Unknown user'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStatusModalTask(null)}
                  disabled={statusMutation.isPending}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (!statusModalTask) return;
                    const currentIndex = SALES_TASK_STAGE_ORDER.indexOf(statusModalTask.status);
                    const targetIndex = SALES_TASK_STAGE_ORDER.indexOf(selectedStatus);
                    if (targetIndex <= currentIndex) {
                      toast.error('Please select the next stage.');
                      return;
                    }
                    statusMutation.mutate({
                      id: statusModalTask.id,
                      status: selectedStatus,
                      comment: statusComment.trim(),
                    });
                  }}
                  disabled={statusMutation.isPending}
                >
                  {statusMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save update
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SalesTasksTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="bg-muted/10 grid grid-cols-[1.2fr,1fr,1.2fr,0.7fr,1fr] gap-3 rounded-md border border-transparent p-3"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
