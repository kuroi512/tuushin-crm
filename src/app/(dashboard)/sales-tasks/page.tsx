'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  History,
  RefreshCcw,
  Check,
  Circle,
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
  MEET: 'Initial meeting',
  CONTACT_BY_PHONE: 'Phone contact',
  MEETING_DATE: 'Meeting date',
  GIVE_INFO: 'Share information',
  CONTRACT: 'Contract',
};

const STATUS_BADGE_VARIANT: Record<SalesTaskStatus, string> = {
  MEET: 'secondary',
  CONTACT_BY_PHONE: 'outline',
  MEETING_DATE: 'default',
  GIVE_INFO: 'default',
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
  meetingDate: string;
  clientName: string;
  salesManagerId: string;
  salesManagerName: string;
  mainComment: string;
  status: SalesTaskStatus;
};

const INITIAL_FORM: CreateFormState = {
  title: '',
  meetingDate: '',
  clientName: '',
  salesManagerId: '',
  salesManagerName: '',
  mainComment: '',
  status: DEFAULT_STAGE,
};

const PAGE_SIZE = 20;

type StageSelectorProps = {
  value: SalesTaskStatus;
  onChange: (value: SalesTaskStatus) => void;
  progress?: SalesTaskProgress | null;
  disabled?: boolean;
  className?: string;
};

function StageSelector({ value, onChange, progress, disabled, className }: StageSelectorProps) {
  const normalized = useMemo(() => ensureSalesTaskProgress(progress), [progress]);

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-5', className)}>
      {SALES_TASK_STAGE_ORDER.map((stage) => {
        const stageProgress = normalized[stage];
        const isActive = stage === value;
        const showAsComplete = stageProgress?.completed || isActive;
        const buttonClass = cn(
          'flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-sm transition',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/60',
          isActive
            ? 'border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/40'
            : showAsComplete
              ? 'border-primary/40 bg-primary/5 text-primary'
              : 'border-muted bg-muted text-muted-foreground',
        );

        const completedAt = stageProgress?.completedAt
          ? format(new Date(stageProgress.completedAt), 'MMM d, yyyy')
          : null;

        return (
          <button
            key={stage}
            type="button"
            onClick={() => {
              if (!disabled) onChange(stage);
            }}
            disabled={disabled}
            className={buttonClass}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-medium">{STATUS_LABELS[stage]}</span>
              {showAsComplete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            </div>
            {completedAt && <span className="text-muted-foreground text-xs">{completedAt}</span>}
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

  const [statusFilter, setStatusFilter] = useState<SalesTaskStatus | 'ALL'>('ALL');
  const [searchValue, setSearchValue] = useState('');
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
    if (statusParam && SALES_TASK_STAGE_ORDER.includes(statusParam as SalesTaskStatus)) {
      setStatusFilter(statusParam as SalesTaskStatus);
    } else {
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  useEffect(() => {
    const pageParam = Number(searchParams.get('page') ?? '1');
    setPage(Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1);
  }, [searchParams]);

  const { data: customersLookup, isLoading: customersLoading } = useLookup('customer');
  const { data: salesLookup, isLoading: salesLoading } = useLookup('sales');

  const customerOptions = useMemo(() => {
    const options = (customersLookup?.data || [])
      .map((c) => c.name)
      .filter((name): name is string => Boolean(name));
    return options.length ? options : [];
  }, [customersLookup?.data]);

  const salesOptions = useMemo(() => {
    return (salesLookup?.data || []).map((item) => ({
      id: item.id,
      name: item.name ?? 'Unknown',
    }));
  }, [salesLookup?.data]);

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
        search: searchValue || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      },
    ],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(PAGE_SIZE));
      if (searchValue) qs.set('search', searchValue);
      if (statusFilter !== 'ALL') qs.set('status', statusFilter);
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim() || undefined,
        meetingDate: form.meetingDate ? new Date(form.meetingDate).toISOString() : undefined,
        clientName: form.clientName.trim(),
        salesManagerId: form.salesManagerId || undefined,
        salesManagerName: form.salesManagerName || undefined,
        mainComment: form.mainComment.trim() || undefined,
        status: form.status,
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

  const applyStatusFilter = useCallback(
    (status: SalesTaskStatus | 'ALL') => {
      setStatusFilter(status);
      const params = new URLSearchParams(searchParams.toString());
      if (status === 'ALL') params.delete('status');
      else params.set('status', status);
      params.set('page', '1');
      setPage(1);
      router.replace(`/sales-tasks${params.size ? `?${params.toString()}` : ''}`);
    },
    [router, searchParams],
  );

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

    if (missing.length) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return;
    }

    createMutation.mutate();
  };

  const statusLogs = statusLogsQuery.data?.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Sales task</CardTitle>
            <CardDescription>Log meeting reports and follow-up actions.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => tasksQuery.refetch()}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)} disabled={!canManage}>
              <Plus className="mr-2 h-4 w-4" /> New task
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-1 flex-col gap-2 md:max-w-sm">
              <Label htmlFor="sales-task-search">Search</Label>
              <Input
                id="sales-task-search"
                placeholder="Search by client or manager"
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => applyStatusFilter('ALL')}
              >
                All
              </Button>
              {SALES_TASK_STAGE_ORDER.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyStatusFilter(status)}
                >
                  {STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border">
            <DataTable columns={columns} data={tasks} hideBuiltInSearch enablePagination={false} />
            {isLoading && (
              <div className="text-muted-foreground flex items-center justify-center px-4 py-8 text-sm">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sales tasks...
              </div>
            )}
            {tasks.length === 0 && !isLoading && (
              <p className="text-muted-foreground px-4 py-6 text-sm">No sales tasks yet.</p>
            )}
          </div>

          {pagination && totalPages > 1 && (
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <div>
                Page {page} of {totalPages} · {totalRows} records
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <Label htmlFor="task-meeting-date">Meeting date</Label>
              <Input
                id="task-meeting-date"
                type="date"
                value={form.meetingDate}
                onChange={(e) => setForm((prev) => ({ ...prev, meetingDate: e.target.value }))}
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
                disabled={salesOptions.length === 0 && salesLoading}
              >
                <SelectTrigger id="task-sales-manager">
                  <SelectValue placeholder={salesLoading ? 'Loading…' : 'Choose sales manager'} />
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
              <Label>Stage</Label>
              <StageSelector
                value={form.status}
                onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
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
                {statusModalTask.meetingDate && (
                  <div className="text-muted-foreground">
                    Meeting date: {format(new Date(statusModalTask.meetingDate), 'yyyy-MM-dd')}
                  </div>
                )}
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
    </div>
  );
}
