import * as React from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * Option interface for SearchableCombobox
 */
export interface ComboboxOption {
  value: string;
  label: string;
  metadata?: string; // Additional display info (e.g., "Delhi" for farmer "Ram - Delhi")
}

/**
 * Props for SearchableCombobox component
 */
export interface SearchableComboboxProps {
  /** Array of options to display */
  options: ComboboxOption[];
  /** Currently selected value */
  value?: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Placeholder text when no value is selected */
  placeholder?: string;
  /** Allow adding new items when search term not found */
  allowAdd?: boolean;
  /** Callback when user wants to add a new item */
  onAddNew?: (searchTerm: string) => void;
  /** Label for the input field */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether data is loading */
  loading?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Additional className for the button */
  className?: string;
  /** Show clear button when value is selected */
  showClear?: boolean;
}

/**
 * SearchableCombobox - A searchable dropdown with keyboard navigation and optional add new functionality
 *
 * @example
 * ```tsx
 * <SearchableCombobox
 *   options={farmers.map(f => ({ value: f.id, label: f.name, metadata: f.village }))}
 *   value={selectedFarmerId}
 *   onChange={setSelectedFarmerId}
 *   placeholder="Select a farmer"
 *   allowAdd
 *   onAddNew={(name) => createNewFarmer(name)}
 * />
 * ```
 *
 * Features:
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Search/filter functionality
 * - Optional "Add new" when search term not found
 * - Clear selection button
 * - Loading state support
 * - Auto-focus on search input when opened
 * - Accessible with ARIA attributes
 */
export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  allowAdd = false,
  onAddNew,
  label,
  required = false,
  disabled = false,
  loading = false,
  emptyMessage = 'No options found.',
  className,
  showClear = true,
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');

  const selectedOption = options.find((option) => option.value === value);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue === value ? '' : selectedValue);
    setOpen(false);
    setSearchTerm('');
  };

  const handleAddNew = () => {
    if (onAddNew && searchTerm.trim()) {
      const newValue = searchTerm.trim();
      onAddNew(newValue);
      onChange(newValue); // Also set the value directly
      setOpen(false);
      setSearchTerm('');
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  // Display label: show selectedOption if found, otherwise show the value itself (for custom values)
  const displayLabel = selectedOption
    ? `${selectedOption.label}${selectedOption.metadata ? ` - ${selectedOption.metadata}` : ''}`
    : value || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-required={required}
          aria-label={label}
          disabled={disabled || loading}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {loading ? 'Loading...' : displayLabel}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {showClear && value && !disabled && !loading && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${label?.toLowerCase() || 'options'}...`}
            value={searchTerm}
            onValueChange={setSearchTerm}
            autoFocus
          />
          <CommandList>
            <CommandEmpty>
              <div className="py-2 text-center text-sm text-muted-foreground">
                {searchTerm && allowAdd && onAddNew ? (
                  <div className="space-y-2">
                    <p>{emptyMessage}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAddNew}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add "{searchTerm}"
                    </Button>
                  </div>
                ) : (
                  emptyMessage
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options
                .filter((option) => {
                  if (!searchTerm) return true;
                  const searchLower = searchTerm.toLowerCase();
                  return (
                    option.label.toLowerCase().includes(searchLower) ||
                    option.metadata?.toLowerCase().includes(searchLower)
                  );
                })
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="flex-1 truncate">
                      {option.label}
                      {option.metadata && (
                        <span className="text-muted-foreground ml-2">
                          {option.metadata}
                        </span>
                      )}
                    </span>
                  </CommandItem>
                ))}
              {searchTerm &&
                allowAdd &&
                onAddNew &&
                !options.some(
                  (option) =>
                    option.label.toLowerCase() === searchTerm.toLowerCase()
                ) && (
                  <CommandItem
                    value={`add-new-${searchTerm}`}
                    onSelect={handleAddNew}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add "{searchTerm}"
                  </CommandItem>
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
