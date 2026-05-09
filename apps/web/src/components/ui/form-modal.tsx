import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Step configuration for multi-step forms
 */
export interface FormStep {
  /** Step number (1, 2, 3, etc.) */
  number: number;
  /** Step label */
  label: string;
}

/**
 * Props for FormModal component
 */
export interface FormModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal description */
  description?: string;
  /** Form content */
  children: React.ReactNode;
  /** Maximum width of modal (default: '3xl') */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  /** Multi-step configuration (optional) */
  steps?: FormStep[];
  /** Current step number (for multi-step forms) */
  currentStep?: number;
  /** Whether to prevent closing on overlay click when form has changes */
  preventCloseOnDirty?: boolean;
  /** Whether form has unsaved changes */
  isDirty?: boolean;
  /** Additional className for the content */
  className?: string;
}

/**
 * FormModal - Standard modal structure for entity forms with optional multi-step support
 *
 * @example
 * Basic usage:
 * ```tsx
 * <FormModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Add New Customer"
 *   description="Fill in the customer details below"
 * >
 *   <CustomerForm />
 * </FormModal>
 * ```
 *
 * Multi-step usage:
 * ```tsx
 * <FormModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   title="Add New Trial"
 *   description="Create a new crop trial by following the steps below"
 *   steps={[
 *     { number: 1, label: 'Basic Info' },
 *     { number: 2, label: 'Applications' },
 *     { number: 3, label: 'Final Details' },
 *   ]}
 *   currentStep={currentStep}
 *   preventCloseOnDirty
 *   isDirty={form.formState.isDirty}
 * >
 *   <TrialFormSteps />
 * </FormModal>
 * ```
 *
 * Features:
 * - Responsive max-width and max-height
 * - Optional multi-step progress indicator
 * - Prevents accidental close when form is dirty
 * - Mobile-friendly (95vw width on small screens)
 * - Scrollable content area
 */
export function FormModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = '3xl',
  steps,
  currentStep = 1,
  preventCloseOnDirty = false,
  isDirty = false,
  className,
}: FormModalProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (preventCloseOnDirty && isDirty) {
        const confirmClose = window.confirm(
          'You have unsaved changes. Are you sure you want to close?'
        );
        if (!confirmClose) return;
      }
      onClose();
    }
  };

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          maxWidthClasses[maxWidth],
          'max-h-[90vh] w-[95vw] overflow-hidden flex flex-col',
          className
        )}
        onPointerDownOutside={(e) => {
          if (preventCloseOnDirty && isDirty) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Multi-step Progress Indicator */}
        {steps && steps.length > 0 && (
          <div className="flex items-center justify-between py-4 border-y">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
                      currentStep >= step.number
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step.number}
                  </div>
                  <span
                    className={cn(
                      'ml-2 text-xs sm:text-sm font-medium hidden sm:inline',
                      currentStep >= step.number
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2 sm:mx-4',
                      currentStep > step.number ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Props for FormModalNavigation component
 */
export interface FormModalNavigationProps {
  /** Current step number */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Callback to go to previous step */
  onPrevious: () => void;
  /** Callback to go to next step or submit */
  onNext: () => void;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Label for the submit button (default: 'Submit') */
  submitLabel?: string;
  /** Custom label for next button (default: 'Next') */
  nextLabel?: string;
  /** Custom label for back button (default: 'Back') */
  backLabel?: string;
}

/**
 * FormModalNavigation - Navigation buttons for multi-step forms
 *
 * @example
 * ```tsx
 * <FormModalNavigation
 *   currentStep={currentStep}
 *   totalSteps={3}
 *   onPrevious={() => setCurrentStep(currentStep - 1)}
 *   onNext={handleNext}
 *   isSubmitting={mutation.isPending}
 *   submitLabel="Create Trial"
 * />
 * ```
 */
export function FormModalNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  isSubmitting = false,
  submitLabel = 'Submit',
  nextLabel = 'Next',
  backLabel = 'Back',
}: FormModalNavigationProps) {
  const isLastStep = currentStep === totalSteps;
  const isFirstStep = currentStep === 1;

  return (
    <div className="flex justify-between pt-4 border-t">
      {!isFirstStep ? (
        <Button type="button" variant="outline" onClick={onPrevious}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>
      ) : (
        <div />
      )}

      <Button type="submit" disabled={isSubmitting} onClick={onNext}>
        {isLastStep ? (
          <>
            {isSubmitting ? 'Submitting...' : submitLabel}
          </>
        ) : (
          <>
            {nextLabel}
            <ChevronRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
