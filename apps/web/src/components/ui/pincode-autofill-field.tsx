import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/axios';
import type { LocationData } from '@/types/location';

/**
 * Props for PincodeAutoFillField component
 */
export interface PincodeAutoFillFieldProps {
  /** Current pincode value */
  value: string;
  /** Callback when pincode value changes */
  onChange: (value: string) => void;
  /** Callback when location data is fetched successfully */
  onLocationFetch?: (locationData: LocationData) => void;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Additional className for the input */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Debounce delay in milliseconds (default: 500ms) */
  debounceDelay?: number;
}

/**
 * PincodeAutoFillField - Smart pincode input with automatic location lookup
 *
 * @example
 * ```tsx
 * <PincodeAutoFillField
 *   value={pincode}
 *   onChange={setPincode}
 *   onLocationFetch={(locationData) => {
 *     form.setValue('village', locationData.village);
 *     form.setValue('city', locationData.city);
 *     form.setValue('taluka', locationData.taluka);
 *     form.setValue('district', locationData.district);
 *     form.setValue('state', locationData.state);
 *   }}
 *   required
 * />
 * ```
 *
 * Features:
 * - Validates Indian pincode format (6 digits)
 * - Debounced API calls to reduce server load
 * - Loading indicator during lookup
 * - Error handling for invalid pincodes
 * - Numeric keyboard on mobile devices
 * - Auto-triggers lookup on blur or after debounce
 */
export function PincodeAutoFillField({
  value,
  onChange,
  onLocationFetch,
  disabled = false,
  required = false,
  className,
  placeholder = 'e.g., 380001',
  debounceDelay = 500,
}: PincodeAutoFillFieldProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = React.useRef<string>('');

  // Fetch location data from API
  const fetchLocationData = React.useCallback(
    async (pincode: string) => {
      // Only fetch if pincode is exactly 6 digits and different from previous
      if (pincode.length !== 6 || pincode === previousValueRef.current) {
        return;
      }

      setIsLoading(true);
      setError(null);
      previousValueRef.current = pincode;

      try {
        const response = await apiClient.get(`/location/pincode/${pincode}`);

        // API returns location data directly, not wrapped in success/data structure
        if (response.data && onLocationFetch) {
          onLocationFetch({
            village: response.data.village || '',
            city: response.data.city || '',
            taluka: response.data.taluka || '',
            district: response.data.district || '',
            state: response.data.state || '',
            pincode: response.data.pincode || pincode,
          });
        }
      } catch (err: any) {
        if (err.response?.status === 404) {
          setError('Pincode not found. Please enter manually.');
        } else if (err.response?.status === 400) {
          setError('Invalid pincode format.');
        } else {
          setError('Failed to fetch location data.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onLocationFetch]
  );

  // Handle input change with debouncing
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, ''); // Only allow digits

    // Limit to 6 digits
    if (newValue.length <= 6) {
      onChange(newValue);
      setError(null);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      if (newValue.length === 6) {
        debounceTimerRef.current = setTimeout(() => {
          fetchLocationData(newValue);
        }, debounceDelay);
      }
    }
  };

  // Handle blur event - trigger immediate lookup if 6 digits
  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (value.length === 6 && value !== previousValueRef.current) {
      fetchLocationData(value);
    }
  };

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          maxLength={6}
          className={cn(
            error && 'border-destructive focus-visible:ring-destructive',
            className
          )}
          aria-label="Pincode"
          aria-invalid={!!error}
          aria-describedby={error ? 'pincode-error' : undefined}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {error && (
        <p
          id="pincode-error"
          className="text-xs text-destructive mt-1"
          role="alert"
        >
          {error}
        </p>
      )}
      {value.length > 0 && value.length < 6 && !error && (
        <p className="text-xs text-muted-foreground mt-1">
          Enter 6-digit pincode
        </p>
      )}
    </div>
  );
}
