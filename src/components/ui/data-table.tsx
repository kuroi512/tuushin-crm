'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings2,
  GripVertical,
  Search,
} from 'lucide-react';
import { useT } from '@/lib/i18n';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  externalSearchValue?: string;
  hideBuiltInSearch?: boolean;
  enableRowReordering?: boolean;
  onRowReorder?: (data: TData[]) => void;
  enableColumnReordering?: boolean;
  onColumnReorder?: (columns: ColumnDef<TData, TValue>[]) => void;
  enableColumnVisibility?: boolean;
  initialColumnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (next: VisibilityState) => void;
  hideColumnVisibilityMenu?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
}

interface SortableRowProps {
  row: any;
  children: React.ReactNode;
}

function SortableRow({ row, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={isDragging ? 'relative z-20' : ''}
    >
      <TableCell className="w-[40px] p-2">
        <div
          {...listeners}
          className="cursor-grab rounded p-1 hover:cursor-grabbing hover:bg-gray-100"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}

interface SortableHeaderProps {
  header: any;
  children: React.ReactNode;
  enableColumnReordering?: boolean;
}

function SortableHeader({ header, children, enableColumnReordering }: SortableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
    disabled: !enableColumnReordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative ${isDragging ? 'z-20' : ''} ${enableColumnReordering ? 'cursor-grab hover:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2">
        {enableColumnReordering && (
          <div {...listeners} className="rounded p-1 hover:bg-gray-100">
            <GripVertical className="h-3 w-3 text-gray-400" />
          </div>
        )}
        {children}
      </div>
    </TableHead>
  );
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  externalSearchValue,
  hideBuiltInSearch = false,
  enableRowReordering = false,
  onRowReorder,
  enableColumnReordering = false,
  onColumnReorder,
  enableColumnVisibility = true,
  initialColumnVisibility,
  onColumnVisibilityChange,
  hideColumnVisibilityMenu = false,
  enablePagination = true,
  pageSize = 15,
}: DataTableProps<TData, TValue>) {
  const t = useT();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    initialColumnVisibility ?? {},
  );
  const [tableData, setTableData] = React.useState(data);
  const [tableColumns, setTableColumns] = React.useState(columns);

  React.useEffect(() => {
    setTableData(data);
  }, [data]);

  React.useEffect(() => {
    setTableColumns(columns);
  }, [columns]);

  // Keep internal visibility state in sync with parent-provided initialColumnVisibility changes
  React.useEffect(() => {
    if (initialColumnVisibility) {
      setColumnVisibility(initialColumnVisibility);
    }
  }, [initialColumnVisibility]);

  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: (updater) => {
      // Support both functional and value updaters
      const nextState =
        typeof updater === 'function'
          ? (updater as (prev: VisibilityState) => VisibilityState)(columnVisibility)
          : updater;
      setColumnVisibility(nextState);
      onColumnVisibilityChange?.(nextState);
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Apply external search filter if provided
  React.useEffect(() => {
    if (!searchKey) return;
    const col = table.getColumn(searchKey);
    if (col) {
      col.setFilterValue(externalSearchValue ?? '');
    }
  }, [externalSearchValue, searchKey]);

  // Compute sticky offsets for left-sticky columns based on meta.width
  const stickyLeftOffsets = React.useMemo(() => {
    const offsets = new Map<string, number>();
    let left = 0;
    const visibleCols = table.getVisibleLeafColumns();
    for (const col of visibleCols) {
      const meta: any = col.columnDef.meta;
      if (meta?.sticky === 'left') {
        offsets.set(col.id, left);
        left += Number(meta?.width ?? 0);
      }
    }
    return offsets;
  }, [table.getState().columnVisibility, table.getVisibleLeafColumns()]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      // Check if we're reordering rows
      const rowIndex = tableData.findIndex((item: any) => item.id === active.id);
      if (rowIndex !== -1) {
        const oldIndex = tableData.findIndex((item: any) => item.id === active.id);
        const newIndex = tableData.findIndex((item: any) => item.id === over?.id);

        const newData = arrayMove(tableData, oldIndex, newIndex);
        setTableData(newData);
        onRowReorder?.(newData);
      } else {
        // We're reordering columns
        const columnIds = tableColumns.map((col: any) => col.id || col.accessorKey);
        const oldIndex = columnIds.findIndex((id) => id === active.id);
        const newIndex = columnIds.findIndex((id) => id === over?.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newColumns = arrayMove(tableColumns, oldIndex, newIndex);
          setTableColumns(newColumns);
          onColumnReorder?.(newColumns);
        }
      }
    }
  };

  const TableContent = () => (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {enableRowReordering && <TableHead className="w-[40px]"></TableHead>}
            {headerGroup.headers
              .filter((header) => header.column.getIsVisible())
              .map((header) =>
                enableColumnReordering ? (
                  <SortableHeader
                    key={header.id}
                    header={header}
                    enableColumnReordering={enableColumnReordering}
                  >
                    {header.isPlaceholder
                      ? null
                      : (() => {
                          const meta: any = header.column.columnDef.meta || {};
                          const stickyLeft = stickyLeftOffsets.get(header.column.id);
                          const style: React.CSSProperties = {};
                          if (meta.width) {
                            style.width = meta.width;
                            style.minWidth = meta.width;
                          }
                          if (stickyLeft !== undefined) {
                            style.position = 'sticky';
                            style.left = stickyLeft;
                          }
                          const cls = `flex items-center space-x-2 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''} ${meta?.className ?? 'px-6 py-4'} ${stickyLeft !== undefined ? 'z-20 bg-background' : ''}`;
                          return (
                            <div
                              className={cls}
                              style={style}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <div className="flex flex-col">
                                  {header.column.getIsSorted() === 'asc' ? (
                                    <ArrowUp className="h-4 w-4" />
                                  ) : header.column.getIsSorted() === 'desc' ? (
                                    <ArrowDown className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                  </SortableHeader>
                ) : (
                  <TableHead key={header.id} className="relative">
                    {header.isPlaceholder
                      ? null
                      : (() => {
                          const meta: any = header.column.columnDef.meta || {};
                          const stickyLeft = stickyLeftOffsets.get(header.column.id);
                          const style: React.CSSProperties = {};
                          if (meta.width) {
                            style.width = meta.width;
                            style.minWidth = meta.width;
                          }
                          if (stickyLeft !== undefined) {
                            style.position = 'sticky';
                            style.left = stickyLeft;
                          }
                          const cls = `flex items-center space-x-2 ${header.column.getCanSort() ? 'cursor-pointer select-none' : ''} ${meta?.className ?? 'px-6 py-4'} ${stickyLeft !== undefined ? 'z-20 bg-background' : ''}`;
                          return (
                            <div
                              className={cls}
                              style={style}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                <div className="flex flex-col">
                                  {header.column.getIsSorted() === 'asc' ? (
                                    <ArrowUp className="h-4 w-4" />
                                  ) : header.column.getIsSorted() === 'desc' ? (
                                    <ArrowDown className="h-4 w-4" />
                                  ) : (
                                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                  </TableHead>
                ),
              )}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) =>
            enableRowReordering ? (
              <SortableRow key={row.id} row={row}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {(() => {
                      const meta: any = cell.column.columnDef.meta || {};
                      const stickyLeft = stickyLeftOffsets.get(cell.column.id);
                      const style: React.CSSProperties = {};
                      if (meta.width) {
                        style.width = meta.width;
                        style.minWidth = meta.width;
                      }
                      if (stickyLeft !== undefined) {
                        style.position = 'sticky';
                        style.left = stickyLeft;
                      }
                      const cls = `${meta?.className ?? 'px-6 py-4'} ${stickyLeft !== undefined ? 'z-10 bg-background' : ''}`;
                      return (
                        <div className={cls} style={style}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      );
                    })()}
                  </TableCell>
                ))}
              </SortableRow>
            ) : (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {(() => {
                      const meta: any = cell.column.columnDef.meta || {};
                      const stickyLeft = stickyLeftOffsets.get(cell.column.id);
                      const style: React.CSSProperties = {};
                      if (meta.width) {
                        style.width = meta.width;
                        style.minWidth = meta.width;
                      }
                      if (stickyLeft !== undefined) {
                        style.position = 'sticky';
                        style.left = stickyLeft;
                      }
                      const cls = `${meta?.className ?? 'px-6 py-4'} ${stickyLeft !== undefined ? 'z-10 bg-background' : ''}`;
                      return (
                        <div className={cls} style={style}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      );
                    })()}
                  </TableCell>
                ))}
              </TableRow>
            ),
          )
        ) : (
          <TableRow>
            <TableCell
              colSpan={table.getVisibleLeafColumns().length + (enableRowReordering ? 1 : 0)}
              className="h-24 text-center"
            >
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex flex-1 items-center space-x-2">
          {!hideBuiltInSearch && searchKey && (
            <div className="relative">
              <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
              <Input
                placeholder={searchPlaceholder}
                value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
                onChange={(event) => table.getColumn(searchKey)?.setFilterValue(event.target.value)}
                className="max-w-sm pl-8"
              />
            </div>
          )}
        </div>
        {enableColumnVisibility && !hideColumnVisibilityMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-auto">
                <Settings2 className="mr-2 h-4 w-4" />
                {t('table.columns')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const headerDef = column.columnDef.header as any;
                  const label = typeof headerDef === 'string' ? headerDef : column.id;
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        {enableRowReordering || enableColumnReordering ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={
                enableColumnReordering
                  ? // Use only visible column ids so DnD stays in sync when columns are hidden
                    table.getVisibleLeafColumns().map((c) => c.id)
                  : tableData.map((item: any) => item.id)
              }
              strategy={
                enableColumnReordering ? horizontalListSortingStrategy : verticalListSortingStrategy
              }
            >
              <TableContent />
            </SortableContext>
          </DndContext>
        ) : (
          <TableContent />
        )}
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex flex-col items-center gap-3 px-2 sm:flex-row sm:justify-between sm:gap-0">
          <div className="text-muted-foreground hidden text-xs sm:block sm:flex-1 sm:text-sm">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-xs font-medium sm:text-sm">Rows per page</p>
              <select
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring h-8 w-[70px] rounded border px-3 py-1 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
              >
                {[15, 30, 45, 60].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-xs font-medium sm:text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
