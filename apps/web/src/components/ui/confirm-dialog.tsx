import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Props for ConfirmDialog component
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when user confirms the action */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Label for confirm button (default: 'Confirm') */
  confirmLabel?: string;
  /** Label for cancel button (default: 'Cancel') */
  cancelLabel?: string;
  /** Variant for confirm button (default: 'destructive' for delete operations) */
  variant?: 'default' | 'destructive';
  /** Whether the action is in progress (shows loading state) */
  loading?: boolean;
}

/**
 * ConfirmDialog - Reusable confirmation dialog for destructive or important actions
 *
 * @example
 * Basic delete confirmation:
 * ```tsx
 * <ConfirmDialog
 *   isOpen={isConfirmOpen}
 *   onClose={() => setIsConfirmOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Confirm Delete"
 *   message="Are you sure you want to delete this trial? This action cannot be undone."
 *   confirmLabel="Delete"
 *   variant="destructive"
 *   loading={deleteMutation.isPending}
 * />
 * ```
 *
 * Custom action confirmation:
 * ```tsx
 * <ConfirmDialog
 *   isOpen={isConfirmOpen}
 *   onClose={() => setIsConfirmOpen(false)}
 *   onConfirm={handleArchive}
 *   title="Archive Product"
 *   message="This product will be archived and hidden from active lists. You can restore it later if needed."
 *   confirmLabel="Archive"
 *   variant="default"
 * />
 * ```
 *
 * Features:
 * - Customizable title, message, and button labels
 * - Loading state on confirm button
 * - Variant support (default, destructive)
 * - Disabled buttons during loading
 * - Accessible with proper ARIA attributes
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
