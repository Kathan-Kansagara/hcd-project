import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { PincodeAutoFillField } from '@/components/ui/pincode-autofill-field';
import { LocationSelector } from '@/components/ui/location-selector';
import type { LocationData } from '@/types/location';
import type { Supplier, CreateSupplierData } from '../services/supplier.service';

interface SupplierFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSupplierData) => void;
  supplier?: Supplier | null;
  isLoading?: boolean;
  defaultCompanyName?: string;
}

const supplierSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_person: z.string().optional(),
  contact: z.string()
    .optional()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit Indian mobile number',
    }),
  email: z.string()
    .optional()
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: 'Invalid email format',
    }),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  payment_terms: z.string().optional(),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

export function SupplierFormDialog({ open, onClose, onSubmit, supplier, isLoading, defaultCompanyName }: SupplierFormDialogProps) {
  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      company_name: '',
      contact_person: '',
      contact: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: 'Gondal',
      state: 'Gujarat',
      district: 'Rajkot',
      pincode: '',
      gstin: '',
      payment_terms: '',
    },
  });

  useEffect(() => {
    if (supplier) {
      form.reset({
        company_name: supplier.company_name,
        contact_person: supplier.contact_person || '',
        contact: supplier.contact,
        email: supplier.email,
        address_line1: supplier.address_line1,
        address_line2: supplier.address_line2 || '',
        city: supplier.city || '',
        state: supplier.state || '',
        district: supplier.district || '',
        pincode: supplier.pincode || '',
        gstin: supplier.gstin || '',
        payment_terms: supplier.payment_terms,
      });
    } else if (defaultCompanyName) {
      form.reset({
        company_name: defaultCompanyName,
        contact_person: '',
        contact: '',
        email: '',
        address_line1: '',
        address_line2: '',
        city: 'Gondal',
        state: 'Gujarat',
        district: 'Rajkot',
        pincode: '',
        gstin: '',
        payment_terms: '',
      });
    } else {
      form.reset({
        company_name: '',
        contact_person: '',
        contact: '',
        email: '',
        address_line1: '',
        address_line2: '',
        city: 'Gondal',
        state: 'Gujarat',
        district: 'Rajkot',
        pincode: '',
        gstin: '',
        payment_terms: '',
      });
    }
  }, [open, supplier, defaultCompanyName, form]);

  const handlePincodeLocationFetch = (locationData: LocationData) => {
    if (locationData.city) {
      form.setValue('city', locationData.city);
    }
    if (locationData.state) {
      form.setValue('state', locationData.state);
    }
  };

  const handleFormSubmit = (data: SupplierFormData) => {
    onSubmit(data as CreateSupplierData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          <DialogDescription>
            {supplier ? 'Update supplier information' : 'Enter details for the new supplier'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Company Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter company name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter contact person name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter contact number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Enter email address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <FormField
              control={form.control}
              name="address_line1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 1</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter address line 1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address_line2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Line 2</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter address line 2 (optional)" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location with Pincode Auto-fill */}
            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl>
                    <PincodeAutoFillField
                      value={field.value}
                      onChange={field.onChange}
                      onLocationFetch={handlePincodeLocationFetch}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Selector with State, District, City (cascading filtering) */}
            <LocationSelector
              control={form.control}
              setValue={form.setValue}
              showFields={{ state: true, district: true, city: true }}
              allowCustomValues={true}
              layout="row"
            />

            {/* Business Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter GSTIN (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Net 30 days" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : supplier ? 'Update Supplier' : 'Add Supplier'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
