import * as React from 'react';
import { Eye, Pencil, Trash, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/pagination';

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T = any> {
  /** Column header label */
  header: string;
  /** Accessor function or key to get cell value */
  accessor: keyof T | ((row: T) => React.ReactNode);
  /** Optional custom cell renderer */
  cell?: (row: T) => React.ReactNode;
  /** Additional className for header */
  headerClassName?: string;
  /** Additional className for cells */
  cellClassName?: string;
  /** Sort key for server-side sorting. If set, the column is sortable. */
  sortKey?: string;
}

/**
 * Row action definition
 */
export interface RowAction {
  /** Action type */
  type: 'view' | 'edit' | 'delete' | 'custom';
  /** Action label */
  label: string;
  /** Action icon (optional for custom actions) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Click handler */
  onClick: (rowId: string) => void;
  /** Whether action should be shown as destructive */
  destructive?: boolean;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  currentPage?: number;
  page?: number;
  totalPages: number;
  total: number;
  limit: number;
}

/**
 * Props for DataTable component
 */
export interface DataTableProps<T = any> {
  /** Table title */
  title: string;
  /** Table description (e.g., "10 total items") */
  description?: string;
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Table data */
  data: T[];
  /** Unique row ID accessor */
  rowId?: keyof T | ((row: T) => string);
  /** Row actions (View, Edit, Delete, etc.) - can be static array or function that returns array based on row */
  rowActions?: RowAction[] | ((row: T) => RowAction[]);
  /** Pagination info */
  pagination?: PaginationInfo;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Whether data is loading */
  loading?: boolean;
  /** Number of skeleton rows to show when loading (default: 10) */
  skeletonRows?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional className for card */
  className?: string;
  /** Whether to enable horizontal scroll on mobile */
  enableHorizontalScroll?: boolean;
  /** Search value (controlled) */
  searchValue?: string;
  /** Callback when search value changes */
  onSearchChange?: (value: string) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Callback when a row is clicked (typically for View action) */
  onRowClick?: (rowId: string, row: T) => void;
  /** Callback when the primary column is clicked (typically for Edit action) */
  onPrimaryColumnClick?: (rowId: string, row: T) => void;
  /** Index of the primary column (default: 0) - shown as clickable link when onPrimaryColumnClick is set */
  primaryColumnIndex?: number;
  /** Current sort field (server-side sorting) */
  sortBy?: string;
  /** Current sort direction (server-side sorting) */
  sortOrder?: 'asc' | 'desc';
  /** Callback when sort changes (server-side sorting) */
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

/**
 * DataTable - Consistent data table component with card wrapper
 *
 * @example
 * ```tsx
 * <DataTable
 *   title="All Trials"
 *   description={`${data?.pagination?.total || 0} total trials`}
 *   columns={[
 *     { header: 'Farmer', accessor: 'farmer', cell: (row) => row.farmer?.name },
 *     { header: 'Product', accessor: 'product', cell: (row) => row.product?.name },
 *     { header: 'Status', accessor: 'status', cell: (row) => <Badge>{row.status}</Badge> },
 *   ]}
 *   data={trials}
 *   rowId="id"
 *   rowActions={[
 *     { type: 'view', label: 'View Details', onClick: handleView },
 *     { type: 'edit', label: 'Edit', onClick: handleEdit },
 *     { type: 'delete', label: 'Delete', onClick: handleDelete, destructive: true },
 *   ]}
 *   pagination={data?.pagination}
 *   onPageChange={setPage}
 *   loading={isLoading}
 * />
 * ```
 *
 * Features:
 * - Card wrapper with title and description
 * - Loading skeleton states
 * - Pagination component at bottom
 * - Row action dropdown menu (View, Edit, Delete)
 * - Responsive wrapper with horizontal scroll on mobile
 * - Empty state display
 */
export function DataTable<T = any>({
  title,
  description,
  columns,
  data,
  rowId = 'id' as keyof T,
  rowActions = [],
  pagination,
  onPageChange,
  loading = false,
  skeletonRows = 10,
  emptyMessage = 'No data found',
  className,
  enableHorizontalScroll = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  onRowClick,
  onPrimaryColumnClick,
  primaryColumnIndex = 0,
  sortBy,
  sortOrder,
  onSortChange,
}: DataTableProps<T>) {
  const getRowId = (row: T): string => {
    if (typeof rowId === 'function') {
      return rowId(row);
    }
    return String(row[rowId]);
  };

  const getCellValue = (row: T, column: DataTableColumn<T>) => {
    if (column.cell) {
      return column.cell(row);
    }
    if (typeof column.accessor === 'function') {
      return column.accessor(row);
    }
    return String(row[column.accessor] || '-');
  };

  const getActionIcon = (action: RowAction) => {
    if (action.icon) return action.icon;
    switch (action.type) {
      case 'view':
        return Eye;
      case 'edit':
        return Pencil;
      case 'delete':
        return Trash;
      default:
        return undefined;
    }
  };

  const getRowActions = (row: T): RowAction[] => {
    if (!rowActions) return [];
    if (typeof rowActions === 'function') {
      return rowActions(row);
    }
    return rowActions;
  };

  const hasAnyActions = typeof rowActions === 'function'
    ? data.some(row => getRowActions(row).length > 0)
    : (rowActions?.length ?? 0) > 0;

  const handleRowClick = (row: T, e: React.MouseEvent) => {
    if (!onRowClick) return;
    // Don't trigger row click if user clicked on an interactive element
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"], [data-primary-click]')) return;
    onRowClick(getRowId(row), row);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {onSearchChange !== undefined && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(skeletonRows)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div
              className={cn(
                enableHorizontalScroll && 'overflow-x-auto'
              )}
            >
              <TooltipProvider delayDuration={300}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column, index) => {
                        const isSortable = !!column.sortKey && !!onSortChange;
                        const isCurrentSort = column.sortKey === sortBy;
                        return (
                          <TableHead
                            key={index}
                            className={cn(
                              column.headerClassName,
                              isSortable && 'cursor-pointer select-none hover:bg-muted/50'
                            )}
                            onClick={isSortable ? () => {
                              const newOrder = isCurrentSort && sortOrder === 'asc' ? 'desc' : 'asc';
                              onSortChange!(column.sortKey!, newOrder);
                            } : undefined}
                          >
                            <div className={cn('flex items-center gap-1', isSortable && 'whitespace-nowrap')}>
                              {column.header}
                              {isSortable && (
                                isCurrentSort ? (
                                  sortOrder === 'asc' ? (
                                    <ArrowUp className="h-3.5 w-3.5 text-primary" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5 text-primary" />
                                  )
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                                )
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                      {hasAnyActions && (
                        <TableHead className="text-right w-auto">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length + (hasAnyActions ? 1 : 0)}
                          className="text-center text-muted-foreground h-32"
                        >
                          {emptyMessage}
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((row) => {
                        const actions = getRowActions(row);
                        const id = getRowId(row);
                        return (
                          <TableRow
                            key={id}
                            className={cn(onRowClick && 'cursor-pointer hover:bg-muted/50')}
                            onClick={(e) => handleRowClick(row, e)}
                          >
                            {columns.map((column, colIndex) => {
                              const isPrimary = colIndex === primaryColumnIndex && onPrimaryColumnClick;
                              const cellContent = getCellValue(row, column);
                              return (
                                <TableCell
                                  key={colIndex}
                                  className={column.cellClassName}
                                >
                                  {isPrimary ? (
                                    <span
                                      data-primary-click
                                      className="cursor-pointer text-primary hover:underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPrimaryColumnClick(id, row);
                                      }}
                                    >
                                      {cellContent}
                                    </span>
                                  ) : (
                                    cellContent
                                  )}
                                </TableCell>
                              );
                            })}
                            {hasAnyActions && (
                              <TableCell className="text-right">
                                {actions.length > 0 && (
                                  <div className="flex items-center justify-end gap-0.5">
                                    {actions.map((action, actionIndex) => {
                                      const Icon = getActionIcon(action);
                                      if (!Icon) return null;
                                      return (
                                        <Tooltip key={actionIndex}>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className={cn(
                                                'h-8 w-8',
                                                action.destructive && 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                              )}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                action.onClick(id);
                                              }}
                                            >
                                              <Icon className="h-4 w-4" />
                                              <span className="sr-only">{action.label}</span>
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top">
                                            {action.label}
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && onPageChange && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.currentPage ?? pagination.page ?? 1}
                  totalPages={pagination.totalPages}
                  onPageChange={onPageChange}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
