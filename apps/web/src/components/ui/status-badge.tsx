import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Status configuration type
 */
export interface StatusConfig {
  /** Badge variant */
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  /** Additional custom className for styling */
  className?: string;
}

/**
 * Predefined status configurations
 */
export const statusConfigs: Record<string, StatusConfig> = {
  // General statuses
  DRAFT: {
    variant: 'outline',
    className: 'bg-background text-foreground border-border hover:bg-muted/50',
  },
  IN_PROGRESS: {
    variant: 'default',
    className: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
  },
  COMPLETED: {
    variant: 'outline',
    className: 'bg-background text-foreground/70 border-border/50 hover:bg-muted/30',
  },
  PENDING: {
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80',
  },
  APPROVED: {
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80',
  },
  REJECTED: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80',
  },

  // Invoice/Payment statuses
  PAID: {
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80',
  },
  UNPAID: {
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100/80',
  },
  OVERDUE: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80',
  },
  PARTIALLY_PAID: {
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80',
  },

  // Order statuses
  CONFIRMED: {
    variant: 'default',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100/80',
  },
  SHIPPED: {
    variant: 'default',
    className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100/80',
  },
  DELIVERED: {
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80',
  },
  RECEIVED: {
    variant: 'default',
    className: 'bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-100/80',
  },
  CANCELLED: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80',
  },

  // Production/Batch statuses
  ACTIVE: {
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80',
  },
  INACTIVE: {
    variant: 'outline',
    className: 'bg-background text-muted-foreground border-border hover:bg-muted/30',
  },
  EXPIRED: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80',
  },
  EXPIRING_SOON: {
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100/80',
  },
  LOW_STOCK: {
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100/80',
  },
  IN_STOCK: {
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100/80',
  },
  OUT_OF_STOCK: {
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100/80',
  },
};

/**
 * Props for StatusBadge component
 */
export interface StatusBadgeProps {
  /** Status value (will be uppercase normalized) */
  status: string;
  /** Custom status config to override defaults */
  customConfig?: StatusConfig;
  /** Additional className */
  className?: string;
  /** Whether to format the status text (replace underscores, capitalize) */
  formatText?: boolean;
}

/**
 * StatusBadge - Consistent status badge with predefined color mappings
 *
 * @example
 * Using predefined status:
 * ```tsx
 * <StatusBadge status="IN_PROGRESS" />
 * <StatusBadge status="COMPLETED" />
 * <StatusBadge status="PAID" />
 * <StatusBadge status="EXPIRING_SOON" />
 * ```
 *
 * With custom config:
 * ```tsx
 * <StatusBadge
 *   status="CUSTOM_STATUS"
 *   customConfig={{
 *     variant: 'default',
 *     className: 'bg-purple-100 text-purple-800'
 *   }}
 * />
 * ```
 *
 * Without text formatting:
 * ```tsx
 * <StatusBadge status="in_progress" formatText={false} />
 * ```
 *
 * Features:
 * - Predefined status color mappings for common statuses
 * - Consistent variant system (default, outline, secondary, destructive)
 * - Automatic text formatting (replace _ with space, capitalize)
 * - Custom config override support
 * - Accessible with semantic HTML
 */
export function StatusBadge({
  status,
  customConfig,
  className,
  formatText = true,
}: StatusBadgeProps) {
  const normalizedStatus = status.toUpperCase();
  const config = customConfig || statusConfigs[normalizedStatus] || {
    variant: 'secondary' as const,
    className: '',
  };

  const displayText = formatText
    ? status.replace(/_/g, ' ')
    : status;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {displayText}
    </Badge>
  );
}
