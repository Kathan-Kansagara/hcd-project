import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * Props for DatePickerField component
 */
export interface DatePickerFieldProps {
  /** Currently selected date */
  value?: Date;
  /** Callback when date changes */
  onChange: (date: Date | undefined) => void;
  /** Label for the field */
  label?: string;
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Show clear button to remove selected date */
  showClear?: boolean;
  /** Additional className for the button */
  className?: string;
  /** Date format for display (default: 'PPP') */
  dateFormat?: string;
}

/**
 * DatePickerField - Consistent calendar date picker with formatted display
 *
 * @example
 * ```tsx
 * <DatePickerField
 *   value={startDate}
 *   onChange={setStartDate}
 *   label="Start Date"
 *   placeholder="Pick a date"
 *   minDate={new Date()}
 *   showClear
 *   required
 * />
 * ```
 *
 * Features:
 * - Calendar popover for date selection
 * - Formatted display using date-fns
 * - Optional clear button
 * - Min/max date validation
 * - Calendar icon indicator
 * - Accessible with ARIA attributes
 * - Mobile-friendly
 */
export function DatePickerField({
  value,
  onChange,
  label,
  placeholder = 'Pick a date',
  disabled = false,
  required = false,
  minDate,
  maxDate,
  showClear = true,
  className,
  dateFormat = 'PPP', // e.g., "April 29, 2023"
}: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const handleSelect = (date: Date | undefined) => {
    onChange(date);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={label}
          aria-required={required}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">
            {value ? format(value, dateFormat) : placeholder}
          </span>
          {showClear && value && !disabled && (
            <X
              className="h-4 w-4 opacity-50 hover:opacity-100 ml-2 shrink-0"
              onClick={handleClear}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
