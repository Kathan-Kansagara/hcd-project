# Reusable UI Components

This directory contains standardized, reusable UI components extracted from the Trials page reference implementation. These components follow shadcn/ui composition patterns and are designed to be used across all entity pages for consistency.

## Components Overview

### 1. SearchableCombobox
**Path:** `searchable-combobox.tsx`

A searchable dropdown with keyboard navigation and optional "Add New" functionality.

**Features:**
- Keyboard navigation (arrow keys, enter, escape)
- Search/filter functionality
- Optional "Add new" when search term not found
- Clear selection button
- Loading state support
- Auto-focus on search input

**Usage:**
```tsx
import { SearchableCombobox } from '@/components/ui/searchable-combobox';

<SearchableCombobox
  options={farmers.map(f => ({
    value: f.id,
    label: f.name,
    metadata: f.village
  }))}
  value={selectedFarmerId}
  onChange={setSelectedFarmerId}
  placeholder="Select a farmer"
  allowAdd
  onAddNew={(name) => createNewFarmer(name)}
  showClear
/>
```

---

### 2. PincodeAutoFillField
**Path:** `pincode-autofill-field.tsx`

Smart pincode input with automatic location lookup from backend API.

**Features:**
- Validates Indian pincode format (6 digits)
- Debounced API calls (500ms default)
- Loading indicator during lookup
- Error handling for invalid pincodes
- Numeric keyboard on mobile devices

**Usage:**
```tsx
import { PincodeAutoFillField } from '@/components/ui/pincode-autofill-field';

<PincodeAutoFillField
  value={pincode}
  onChange={setPincode}
  onLocationFetch={(locationData) => {
    form.setValue('village', locationData.village);
    form.setValue('city', locationData.city);
    form.setValue('taluka', locationData.taluka);
    form.setValue('district', locationData.district);
    form.setValue('state', locationData.state);
  }}
  required
/>
```

---

### 3. LocationFieldGroup
**Path:** `location-field-group.tsx`

Grouped component for all location/address fields with bi-directional auto-fill.

**Features:**
- Pincode auto-fill: Enter pincode → auto-fills all location fields
- Village auto-fill: Select village → auto-fills city, taluka, district, state
- Bi-directional compatibility
- Manual override allowed
- Responsive grid layout

**Usage:**
```tsx
import { LocationFieldGroup } from '@/components/ui/location-field-group';

<LocationFieldGroup
  control={form.control}
  setValue={form.setValue}
  requiredFields={{ village: true, pincode: true }}
  enableVillageAutofill
  enablePincodeAutofill
/>
```

---

### 4. DatePickerField
**Path:** `date-picker-field.tsx`

Consistent calendar date picker with formatted display.

**Features:**
- Calendar popover for date selection
- Formatted display using date-fns (customizable format)
- Optional clear button
- Min/max date validation
- Calendar icon indicator

**Usage:**
```tsx
import { DatePickerField } from '@/components/ui/date-picker-field';

<DatePickerField
  value={startDate}
  onChange={setStartDate}
  label="Start Date"
  placeholder="Pick a date"
  minDate={new Date()}
  showClear
  required
  dateFormat="PPP" // e.g., "April 29, 2023"
/>
```

---

### 5. FormModal
**Path:** `form-modal.tsx`

Standard modal structure for entity forms with optional multi-step support.

**Features:**
- Responsive max-width and max-height
- Optional multi-step progress indicator
- Prevents accidental close when form is dirty
- Scrollable content area
- Mobile-friendly (95vw width on small screens)

**Usage:**

Basic form:
```tsx
import { FormModal } from '@/components/ui/form-modal';

<FormModal
  isOpen={isOpen}
  onClose={onClose}
  title="Add New Customer"
  description="Fill in the customer details below"
>
  <CustomerForm />
</FormModal>
```

Multi-step form:
```tsx
<FormModal
  isOpen={isOpen}
  onClose={onClose}
  title="Add New Trial"
  steps={[
    { number: 1, label: 'Basic Info' },
    { number: 2, label: 'Applications' },
    { number: 3, label: 'Final Details' },
  ]}
  currentStep={currentStep}
  preventCloseOnDirty
  isDirty={form.formState.isDirty}
>
  <TrialFormSteps />
</FormModal>
```

**Navigation Component:**
```tsx
import { FormModalNavigation } from '@/components/ui/form-modal';

<FormModalNavigation
  currentStep={currentStep}
  totalSteps={3}
  onPrevious={() => setCurrentStep(currentStep - 1)}
  onNext={handleNext}
  isSubmitting={mutation.isPending}
  submitLabel="Create Trial"
/>
```

---

### 6. PageHeader
**Path:** `page-header.tsx`

Consistent page header with title, description, and action buttons.

**Features:**
- Title and description layout
- Action buttons positioned top-right
- Optional filters button
- Responsive layout (stacks buttons on mobile)
- Optional breadcrumb support

**Usage:**
```tsx
import { PageHeader } from '@/components/ui/page-header';
import { Download, Plus } from 'lucide-react';

<PageHeader
  title="Trials"
  description="Manage and monitor all crop trials"
  actions={[
    {
      label: 'Export Excel',
      icon: Download,
      variant: 'outline',
      onClick: exportToExcel,
    },
    {
      label: 'New Trial',
      icon: Plus,
      variant: 'default',
      onClick: () => setIsAddModalOpen(true),
    },
  ]}
  showFilters
  onFiltersToggle={() => setShowFilters(!showFilters)}
  filtersOpen={showFilters}
/>
```

---

### 7. DataTable
**Path:** `data-table.tsx`

Consistent data table component with card wrapper, pagination, and row actions.

**Features:**
- Card wrapper with title and description
- Loading skeleton states
- Pagination component at bottom
- Row action dropdown menu (View, Edit, Delete)
- Responsive wrapper with horizontal scroll on mobile
- Empty state display

**Usage:**
```tsx
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

<DataTable
  title="All Trials"
  description={`${data?.pagination?.total || 0} total trials`}
  columns={[
    {
      header: 'Farmer',
      accessor: 'farmer',
      cell: (row) => row.farmer?.name || '-'
    },
    {
      header: 'Product',
      accessor: 'product',
      cell: (row) => row.product?.name || '-'
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => <Badge>{row.status}</Badge>
    },
  ]}
  data={trials}
  rowId="id"
  rowActions={[
    { type: 'view', label: 'View Details', onClick: handleView },
    { type: 'edit', label: 'Edit', onClick: handleEdit },
    { type: 'delete', label: 'Delete', onClick: handleDelete, destructive: true },
  ]}
  pagination={data?.pagination}
  onPageChange={setPage}
  loading={isLoading}
/>
```

---

### 8. ConfirmDialog
**Path:** `confirm-dialog.tsx`

Reusable confirmation dialog for destructive or important actions.

**Features:**
- Customizable title, message, and button labels
- Loading state on confirm button
- Variant support (default, destructive)
- Disabled buttons during loading

**Usage:**

Delete confirmation:
```tsx
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

<ConfirmDialog
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  onConfirm={handleDelete}
  title="Confirm Delete"
  message="Are you sure you want to delete this trial? This action cannot be undone."
  confirmLabel="Delete"
  variant="destructive"
  loading={deleteMutation.isPending}
/>
```

Custom action:
```tsx
<ConfirmDialog
  isOpen={isConfirmOpen}
  onClose={() => setIsConfirmOpen(false)}
  onConfirm={handleArchive}
  title="Archive Product"
  message="This product will be archived and hidden from active lists."
  confirmLabel="Archive"
  variant="default"
/>
```

---

### 9. StatusBadge
**Path:** `status-badge.tsx`

Consistent status badge with predefined color mappings.

**Features:**
- Predefined status color mappings for common statuses
- Consistent variant system
- Automatic text formatting (replace _ with space)
- Custom config override support

**Predefined Statuses:**
- DRAFT, IN_PROGRESS, COMPLETED
- PENDING, APPROVED, REJECTED
- PAID, UNPAID, OVERDUE, PARTIALLY_PAID
- CONFIRMED, SHIPPED, DELIVERED, CANCELLED
- ACTIVE, INACTIVE, EXPIRED, LOW_STOCK

**Usage:**
```tsx
import { StatusBadge } from '@/components/ui/status-badge';

// Using predefined status
<StatusBadge status="IN_PROGRESS" />
<StatusBadge status="COMPLETED" />
<StatusBadge status="PAID" />

// With custom config
<StatusBadge
  status="CUSTOM_STATUS"
  customConfig={{
    variant: 'default',
    className: 'bg-purple-100 text-purple-800'
  }}
/>

// Without text formatting
<StatusBadge status="in_progress" formatText={false} />
```

---

### 10. PhotoUploadField
**Path:** `photo-upload-field.tsx`

File input with preview, validation, and multiple file support.

**Features:**
- Single or multiple file support
- Preview thumbnails for selected images
- File count display
- Remove individual file functionality
- File size and type validation
- Upload icon indicator

**Usage:**

Single file:
```tsx
import { PhotoUploadField } from '@/components/ui/photo-upload-field';

<PhotoUploadField
  value={photo}
  onChange={(files) => setPhoto(files?.[0] || null)}
  label="Profile Photo"
  showPreview
  required
  maxFileSize={5 * 1024 * 1024} // 5MB
/>
```

Multiple files:
```tsx
<PhotoUploadField
  value={photos}
  onChange={setPhotos}
  label="Application Photos"
  multiple
  maxFiles={5}
  showPreview
/>
```

---

## Design Principles

All components follow these principles:

1. **Composition over Configuration:** Components are composable and work well with shadcn/ui patterns
2. **TypeScript First:** All props are strongly typed with interfaces
3. **Accessibility:** ARIA attributes, keyboard navigation, screen reader support
4. **Mobile Responsive:** Touch-friendly, responsive layouts, proper input types
5. **Consistent Styling:** Uses Tailwind CSS with consistent color and spacing
6. **Form Integration:** Works seamlessly with React Hook Form and Zod validation
7. **Loading States:** All components handle loading and error states gracefully
8. **Documented:** JSDoc comments with usage examples for all components

---

## Testing

Component tests are located in `/apps/web/tests/components/`:

- `searchable-combobox.spec.ts` - Tests keyboard navigation and add new functionality
- `date-picker.spec.ts` - Tests calendar interaction and date selection
- `status-badge.spec.ts` - Tests badge rendering and styling
- `confirm-dialog.spec.ts` - Tests dialog behavior and button states
- `pincode-autofill.spec.ts` - Tests pincode validation and API integration

Run tests:
```bash
cd apps/web
npx playwright test tests/components/
```

---

## Contributing

When adding new reusable components:

1. Follow the existing component structure and patterns
2. Add TypeScript interfaces for all props
3. Include JSDoc comments with usage examples
4. Ensure mobile responsiveness
5. Add Playwright tests for critical functionality
6. Update this README with component documentation

---

## Related Documentation

- shadcn/ui components: `/apps/web/src/components/ui/`
- Reference implementation: `/apps/web/src/pages/TrialsPageNew.tsx`
- Form patterns: `/apps/web/src/components/trials/AddTrialModalNew.tsx`
