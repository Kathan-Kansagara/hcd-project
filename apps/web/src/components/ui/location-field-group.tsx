import * as React from 'react';
import type { Control, FieldValues, Path, PathValue, UseFormSetValue } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PincodeAutoFillField } from '@/components/ui/pincode-autofill-field';
import type { LocationData } from '@/types/location';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { locationService } from '@/services/location.service';
import { farmerService } from '@/services/farmer.service';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Convert text to Title Case (e.g., "vanthali" -> "Vanthali", "VANTHALI" -> "Vanthali")
 */
const toTitleCase = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Local type for combobox options to avoid import issues
type ComboboxOption = { value: string; label: string; metadata?: string };

/**
 * Props for LocationFieldGroup component
 */
export interface LocationFieldGroupProps<T extends FieldValues> {
  /** React Hook Form control object */
  control: Control<T>;
  /** React Hook Form setValue function */
  setValue: UseFormSetValue<T>;
  /** Whether all fields are disabled */
  disabled?: boolean;
  /** Configuration for which fields are required */
  requiredFields?: {
    pincode?: boolean;
    village?: boolean;
    city?: boolean;
    district?: boolean;
    state?: boolean;
  };
  /** Field name prefix (e.g., 'address.' for nested fields) */
  fieldPrefix?: string;
  /** Whether to show village as searchable combobox (default: true) */
  enableVillageAutofill?: boolean;
  /** Whether to show pincode autofill (default: true) */
  enablePincodeAutofill?: boolean;
}

/**
 * LocationFieldGroup - Grouped component for all location/address fields with bi-directional auto-fill
 *
 * @example
 * ```tsx
 * <LocationFieldGroup
 *   control={form.control}
 *   setValue={form.setValue}
 *   requiredFields={{ village: true, pincode: true }}
 *   enableVillageAutofill
 *   enablePincodeAutofill
 * />
 * ```
 *
 * Features:
 * - Pincode auto-fill: Enter pincode → auto-fills all location fields
 * - Village auto-fill: Select village → auto-fills city, taluka, district, state
 * - Bi-directional compatibility: Both auto-fill methods work together
 * - Manual override: All auto-filled values remain editable
 * - Responsive grid layout: 1 column on mobile, 2 columns on desktop
 * - Searchable village dropdown with existing villages
 */
export function LocationFieldGroup<T extends FieldValues>({
  control,
  setValue,
  disabled = false,
  requiredFields = {},
  fieldPrefix = '',
  enableVillageAutofill = true,
  enablePincodeAutofill = false,
}: LocationFieldGroupProps<T>) {
  const queryClient = useQueryClient();

  // Watch state field value for cascading district dropdown
  const stateValue = useWatch({
    control,
    name: `${fieldPrefix}state` as Path<T>,
  });

  // Set default state to Gujarat and district to Rajkot on mount if not already set
  React.useEffect(() => {
    if (!stateValue) {
      setValue(`${fieldPrefix}state` as Path<T>, 'Gujarat' as PathValue<T, Path<T>>);
      setValue(`${fieldPrefix}district` as Path<T>, 'Rajkot' as PathValue<T, Path<T>>);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch all states
  const { data: states } = useQuery({
    queryKey: ['location-states'],
    queryFn: () => locationService.getStates(),
  });

  // Fetch districts based on selected state
  const { data: districts } = useQuery({
    queryKey: ['location-districts', stateValue],
    queryFn: () => locationService.getDistricts(stateValue as string),
    enabled: !!stateValue,
  });

  // Fetch location options for village dropdown
  const { data: villages } = useQuery({
    queryKey: ['farmer-villages'],
    queryFn: () => farmerService.getLocations('village'),
    enabled: enableVillageAutofill,
    staleTime: 0, // Consider data stale immediately, but don't auto-refetch
  });

  // Fetch location options for city dropdown
  const { data: cities } = useQuery({
    queryKey: ['farmer-cities'],
    queryFn: () => farmerService.getLocations('city'),
    staleTime: 0, // Consider data stale immediately, but don't auto-refetch
  });

  // Handle pincode autofill
  const handlePincodeLocationFetch = React.useCallback(
    (locationData: LocationData) => {
      if (locationData.village) {
        setValue(`${fieldPrefix}village` as Path<T>, locationData.village as PathValue<T, Path<T>>);
      }
      if (locationData.city) {
        setValue(`${fieldPrefix}city` as Path<T>, locationData.city as PathValue<T, Path<T>>);
      }
      if (locationData.district) {
        setValue(`${fieldPrefix}district` as Path<T>, locationData.district as PathValue<T, Path<T>>);
      }
      if (locationData.state) {
        setValue(`${fieldPrefix}state` as Path<T>, locationData.state as PathValue<T, Path<T>>);
      }
    },
    [setValue, fieldPrefix]
  );

  // Handle village selection autofill
  const handleVillageSelect = React.useCallback(
    async (villageName: string) => {
      setValue(`${fieldPrefix}village` as Path<T>, villageName as PathValue<T, Path<T>>);

      try {
        const response = await farmerService.getLocationDetails(villageName);
        if (response?.location) {
          if (response.location.city) {
            setValue(`${fieldPrefix}city` as Path<T>, response.location.city as PathValue<T, Path<T>>);
          }
          if (response.location.district) {
            setValue(`${fieldPrefix}district` as Path<T>, response.location.district as PathValue<T, Path<T>>);
          }
          if (response.location.state) {
            setValue(`${fieldPrefix}state` as Path<T>, response.location.state as PathValue<T, Path<T>>);
          }
          if (response.location.pincode) {
            setValue(`${fieldPrefix}pincode` as Path<T>, response.location.pincode as PathValue<T, Path<T>>);
          }
        }
      } catch (error) {
        console.error('Failed to fetch village location details:', error);
      }
    },
    [setValue, fieldPrefix]
  );

  const villageOptions: ComboboxOption[] = React.useMemo(
    () => (villages || []).map((village) => ({ value: village, label: village })),
    [villages]
  );

  const cityOptions: ComboboxOption[] = React.useMemo(
    () => (cities || []).map((city) => ({ value: city, label: city })),
    [cities]
  );

  return (
    <div className="space-y-4">
      {/* State and District - Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${fieldPrefix}state` as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                State {requiredFields.state && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    // Clear district when state changes
                    setValue(`${fieldPrefix}district` as Path<T>, '' as PathValue<T, Path<T>>);
                  }}
                  options={(states || []).map((state) => ({ label: state, value: state }))}
                  placeholder="Select state"
                  emptyMessage="No state found"
                  label="state"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${fieldPrefix}district` as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                District {requiredFields.district && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={field.onChange}
                  options={(districts || []).map((district) => ({ label: district, value: district }))}
                  placeholder={stateValue ? "Select district" : "First select a state"}
                  emptyMessage="No district found"
                  label="district"
                  disabled={disabled || !stateValue}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* City and Village - Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          control={control}
          name={`${fieldPrefix}city` as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                City {requiredFields.city && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={(value) => {
                    const normalizedValue = toTitleCase(value);
                    field.onChange(normalizedValue);
                  }}
                  options={cityOptions}
                  placeholder="Select or type city"
                  emptyMessage="No city found"
                  allowAdd={true}
                  onAddNew={(value) => {
                    const normalizedValue = toTitleCase(value);
                    // Optimistically update the cities cache
                    queryClient.setQueryData(['farmer-cities'], (old: string[] | undefined) => {
                      if (!old) return [normalizedValue];
                      if (old.includes(normalizedValue)) return old;
                      return [...old, normalizedValue];
                    });
                    field.onChange(normalizedValue);
                  }}
                  label="city"
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`${fieldPrefix}village` as Path<T>}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Village {requiredFields.village && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                {enableVillageAutofill ? (
                  <SearchableCombobox
                    options={villageOptions}
                    value={field.value || ''}
                    onChange={handleVillageSelect}
                    placeholder="Select or type village..."
                    disabled={disabled}
                    required={requiredFields.village}
                    label="village"
                    allowAdd={true}
                    onAddNew={(value) => {
                      const normalizedValue = toTitleCase(value);
                      // Optimistically update the villages cache
                      queryClient.setQueryData(['farmer-villages'], (old: string[] | undefined) => {
                        if (!old) return [normalizedValue];
                        if (old.includes(normalizedValue)) return old;
                        return [...old, normalizedValue];
                      });
                      handleVillageSelect(normalizedValue);
                    }}
                    emptyMessage="No villages found"
                  />
                ) : (
                  <Input
                    {...field}
                    placeholder="e.g., Chandkheda"
                    disabled={disabled}
                    required={requiredFields.village}
                  />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Pincode - Full Width */}
      <FormField
        control={control}
        name={`${fieldPrefix}pincode` as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Pincode {requiredFields.pincode && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              {enablePincodeAutofill ? (
                <PincodeAutoFillField
                  value={field.value || ''}
                  onChange={field.onChange}
                  onLocationFetch={handlePincodeLocationFetch}
                  disabled={disabled}
                  required={requiredFields.pincode}
                />
              ) : (
                <Input
                  {...field}
                  placeholder="e.g., 380001"
                  disabled={disabled}
                  required={requiredFields.pincode}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    field.onChange(value);
                  }}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
