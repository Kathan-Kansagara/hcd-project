import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Action button configuration for page header
 */
export interface PageHeaderAction {
  /** Button label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Button icon (React component) */
  icon?: React.ComponentType<{ className?: string }>;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  /** Whether button is disabled */
  disabled?: boolean;
}

/**
 * Props for PageHeader component
 */
export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Page description/subtitle */
  description?: string;
  /** Action buttons - either array of action objects or JSX elements */
  actions?: PageHeaderAction[] | React.ReactNode;
  /** Whether to show filters button */
  showFilters?: boolean;
  /** Callback when filters button is clicked */
  onFiltersToggle?: () => void;
  /** Whether filters are currently shown */
  filtersOpen?: boolean;
  /** Breadcrumb items (optional) */
  breadcrumbs?: Array<{ label: string; href?: string }>;
  /** Additional className */
  className?: string;
}

/**
 * PageHeader - Consistent page header with title, description, and action buttons
 *
 * @example
 * Using action objects:
 * ```tsx
 * <PageHeader
 *   title="Trials"
 *   description="Manage and monitor all crop trials"
 *   actions={[
 *     {
 *       label: 'Export Excel',
 *       icon: Download,
 *       variant: 'outline',
 *       onClick: exportToExcel,
 *     },
 *     {
 *       label: 'New Trial',
 *       icon: Plus,
 *       variant: 'default',
 *       onClick: () => setIsAddModalOpen(true),
 *     },
 *   ]}
 *   showFilters
 *   onFiltersToggle={() => setShowFilters(!showFilters)}
 *   filtersOpen={showFilters}
 * />
 * ```
 *
 * Using JSX elements:
 * ```tsx
 * <PageHeader
 *   title="Production"
 *   description="Create finished product batches"
 *   actions={
 *     <>
 *       <Button variant="outline" onClick={exportToExcel}>
 *         <Download className="mr-2 h-4 w-4" />
 *         Export Excel
 *       </Button>
 *       <Button onClick={handleCreate}>
 *         <Plus className="mr-2 h-4 w-4" />
 *         Create Batch
 *       </Button>
 *     </>
 *   }
 * />
 * ```
 *
 * Features:
 * - Title and description layout
 * - Action buttons positioned top-right
 * - Optional filters button below header
 * - Responsive layout (stacks buttons on mobile)
 * - Optional breadcrumb support
 * - Consistent spacing using Tailwind classes
 * - Supports both action object arrays and JSX elements
 */
export function PageHeader({
  title,
  description,
  actions,
  showFilters = false,
  onFiltersToggle,
  filtersOpen = false,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const isActionsArray = Array.isArray(actions);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Breadcrumbs (if provided) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span>/</span>}
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title, Description, and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        {actions && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isActionsArray ? (
              // Render from action objects
              (actions as PageHeaderAction[]).map((action, index) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={index}
                    variant={action.variant || 'default'}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className="w-full sm:w-auto"
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    {action.label}
                  </Button>
                );
              })
            ) : (
              // Render JSX elements directly
              actions
            )}
          </div>
        )}
      </div>

      {/* Filters Button */}
      {showFilters && onFiltersToggle && (
        <div>
          <Button
            variant="outline"
            onClick={onFiltersToggle}
            className="w-full sm:w-auto"
          >
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
      )}
    </div>
  );
}
