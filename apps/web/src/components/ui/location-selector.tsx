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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import {
  INDIAN_STATES,
  getDistrictsByState,
  getCitiesByDistrict,
  getAllCities,
} from '@/lib/constants/indian-locations';

/**
 * Props for LocationSelector component
 */
export interface LocationSelectorProps<T extends FieldValues> {
  /** React Hook Form control object */
  control: Control<T>;
  /** React Hook Form setValue function */
  setValue: UseFormSetValue<T>;
  /** Whether all fields are disabled */
  disabled?: boolean;
  /** Configuration for which fields are required */
  requiredFields?: {
    state?: boolean;
    district?: boolean;
    city?: boolean;
  };
  /** Field name prefix (e.g., 'address.' for nested fields) */
  fieldPrefix?: string;
  /** Whether to show all fields or just some */
  showFields?: {
    state?: boolean;
    district?: boolean;
    city?: boolean;
  };
  /** Labels for fields (optional customization) */
  labels?: {
    state?: string;
    district?: string;
    city?: string;
  };
  /** Whether to allow custom values (not in predefined lists) */
  allowCustomValues?: boolean;
  /** Layout: 'row' (side by side) or 'column' (stacked) */
  layout?: 'row' | 'column';
}

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

/**
 * LocationSelector - Reusable component for State, District, City selection with cascading filtering
 *
 * @example
 * ```tsx
 * <LocationSelector
 *   control={form.control}
 *   setValue={form.setValue}
 *   requiredFields={{ state: true, city: true }}
 *   showFields={{ state: true, district: true, city: true }}
 *   allowCustomValues
 * />
 * ```
 *
 * Features:
 * - Cascading dropdowns: State -> District -> City
 * - Auto-filtering: Selecting state filters districts, selecting district filters cities
 * - Allow custom values: User can type custom state/district/city if not in list
 * - Flexible layout: Row or column layout
 * - Customizable labels and required fields
 * - Bi-directional updates: Changing state resets district and city
 * - Title Case normalization: Custom values are converted to Title Case
 */
export function LocationSelector<T extends FieldValues>({
  control,
  setValue,
  disabled = false,
  requiredFields = {},
  fieldPrefix = '',
  showFields = { state: true, district: true, city: true },
  labels = {},
  allowCustomValues = true,
  layout = 'row',
}: LocationSelectorProps<T>) {
  // Watch form values directly to enable filtering
  const currentState = useWatch({
    control,
    name: `${fieldPrefix}state` as Path<T>,
    defaultValue: '' as PathValue<T, Path<T>>,
  }) as string || '';

  const currentDistrict = useWatch({
    control,
    name: `${fieldPrefix}district` as Path<T>,
    defaultValue: '' as PathValue<T, Path<T>>,
  }) as string || '';

  // Get filtered options based on selections
  const districtOptions = React.useMemo(() => {
    if (!currentState) return [];
    const districts = getDistrictsByState(currentState);
    return districts.map(d => ({ label: d, value: d }));
  }, [currentState]);

  const cityOptions = React.useMemo(() => {
    if (currentDistrict) {
      // If district is selected, show only cities from that district
      const cities = getCitiesByDistrict(currentDistrict);
      return cities.map(c => ({ label: c, value: c }));
    } else if (currentState) {
      // If only state is selected, show all cities from all districts in that state
      const districts = getDistrictsByState(currentState);
      const allCities = new Set<string>();
      districts.forEach(district => {
        const cities = getCitiesByDistrict(district);
        cities.forEach(city => allCities.add(city));
      });
      return Array.from(allCities).sort().map(c => ({ label: c, value: c }));
    } else {
      // No state selected, show all cities
      const cities = getAllCities();
      return cities.map(c => ({ label: c, value: c }));
    }
  }, [currentState, currentDistrict]);

  // Handle state change - reset district and city
  const handleStateChange = React.useCallback(
    (value: string) => {
      setValue(`${fieldPrefix}state` as Path<T>, value as PathValue<T, Path<T>>);

      // Reset district and city when state changes
      if (showFields.district) {
        setValue(`${fieldPrefix}district` as Path<T>, '' as PathValue<T, Path<T>>);
      }
      if (showFields.city) {
        setValue(`${fieldPrefix}city` as Path<T>, '' as PathValue<T, Path<T>>);
      }
    },
    [setValue, fieldPrefix, showFields.district, showFields.city]
  );

  // Handle district change - reset city
  const handleDistrictChange = React.useCallback(
    (value: string) => {
      // Normalize to Title Case for consistency
      const normalizedValue = toTitleCase(value);
      setValue(`${fieldPrefix}district` as Path<T>, normalizedValue as PathValue<T, Path<T>>);

      // Reset city when district changes
      if (showFields.city) {
        setValue(`${fieldPrefix}city` as Path<T>, '' as PathValue<T, Path<T>>);
      }
    },
    [setValue, fieldPrefix, showFields.city]
  );

  // Handle city change
  const handleCityChange = React.useCallback(
    (value: string) => {
      // Normalize to Title Case for consistency
      const normalizedValue = toTitleCase(value);
      setValue(`${fieldPrefix}city` as Path<T>, normalizedValue as PathValue<T, Path<T>>);
    },
    [setValue, fieldPrefix]
  );

  const containerClass = layout === 'row'
    ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
    : 'space-y-4';

  return (
    <div className={containerClass}>
      {/* State Field */}
      {showFields.state && (
        <FormField
          control={control}
          name={`${fieldPrefix}state` as Path<T>}
          render={({ field }) => (
            <FormItem className={layout === 'column' ? 'w-full' : ''}>
              <FormLabel>
                {labels.state || 'State'} {requiredFields.state && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={handleStateChange}
                  options={INDIAN_STATES.map(s => ({ label: s, value: s }))}
                  placeholder="Select state"
                  emptyMessage="No state found"
                  disabled={disabled}
                  label="state"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* District Field */}
      {showFields.district && (
        <FormField
          control={control}
          name={`${fieldPrefix}district` as Path<T>}
          render={({ field }) => (
            <FormItem className={layout === 'column' ? 'w-full' : ''}>
              <FormLabel>
                {labels.district || 'District'} {requiredFields.district && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={handleDistrictChange}
                  options={districtOptions}
                  placeholder={currentState ? 'Select district' : 'Select state first'}
                  emptyMessage={currentState ? 'No district found' : 'Please select a state first'}
                  disabled={disabled || !currentState}
                  allowAdd={allowCustomValues}
                  onAddNew={allowCustomValues ? (value) => handleDistrictChange(value) : undefined}
                  label="district"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* City Field */}
      {showFields.city && (
        <FormField
          control={control}
          name={`${fieldPrefix}city` as Path<T>}
          render={({ field }) => (
            <FormItem className={layout === 'column' ? 'w-full' : ''}>
              <FormLabel>
                {labels.city || 'City'} {requiredFields.city && <span className="text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <SearchableCombobox
                  value={field.value || ''}
                  onChange={handleCityChange}
                  options={cityOptions}
                  placeholder="Select or type city"
                  emptyMessage="No city found"
                  disabled={disabled}
                  allowAdd={allowCustomValues}
                  onAddNew={allowCustomValues ? (value) => handleCityChange(value) : undefined}
                  label="city"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
