import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormField, FormControl, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PincodeAutoFillField } from '@/components/ui/pincode-autofill-field';
import { LocationSelector } from '@/components/ui/location-selector';
import type { LocationData } from '@/types/location';
import type { Customer, CreateCustomerData } from '../services/customer.service';

interface CustomerFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerData) => void;
  customer?: Customer | null;
  isLoading?: boolean;
  /** Pre-set customer type when creating from sales order */
  customerType?: 'company' | 'individual';
  /** Pre-fill the name when adding from a search */
  defaultName?: string;
}

// Schema for company customers (strict validation)
const companyCustomerSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  client_name: z.string().optional(),
  contact: z.string()
    .min(1, 'Contact is required')
    .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10-digit Indian mobile number'),
  email: z.string().email('Invalid email format'),
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  district: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  gstin: z.string().optional(),
  place_of_supply: z.string().min(1, 'Place of supply is required'),
  payment_terms: z.string().min(1, 'Payment terms are required'),
});

// Schema for individual customers (relaxed validation)
const individualCustomerSchema = z.object({
  company_name: z.string().min(1, 'Customer name is required'),
  client_name: z.string().optional(),
  contact: z.string()
    .min(1, 'Contact is required')
    .regex(/^[6-9]\d{9}$/, 'Phone number must be a valid 10-digit Indian mobile number'),
  email: z.string().email('Invalid email format').or(z.literal('')).optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').or(z.literal('')).optional(),
  gstin: z.string().optional(),
  place_of_supply: z.string().optional(),
  payment_terms: z.string().optional(),
});

type CustomerFormData = z.infer<typeof companyCustomerSchema>;

export function CustomerFormDialog({ open, onClose, onSubmit, customer, isLoading, customerType, defaultName }: CustomerFormDialogProps) {
  const effectiveType = customer?.customer_type || customerType || 'company';
  const isIndividual = effectiveType === 'individual';
  const schema = isIndividual ? individualCustomerSchema : companyCustomerSchema;

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: defaultName || '',
      client_name: '',
      contact: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: 'Gondal',
      state: 'Gujarat',
      district: 'Rajkot',
      pincode: '',
      gstin: '',
      place_of_supply: '',
      payment_terms: isIndividual ? 'Immediate' : '',
    },
  });

  useEffect(() => {
    if (customer) {
      form.reset({
        company_name: customer.company_name,
        client_name: customer.client_name || '',
        contact: customer.contact,
        email: customer.email || '',
        address_line1: customer.address_line1 || '',
        address_line2: customer.address_line2 || '',
        city: customer.city || '',
        state: customer.state || '',
        district: customer.district || '',
        pincode: customer.pincode || '',
        gstin: customer.gstin || '',
        place_of_supply: customer.place_of_supply || '',
        payment_terms: customer.payment_terms,
      });
    } else {
      form.reset({
        company_name: defaultName || '',
        client_name: '',
        contact: '',
        email: '',
        address_line1: '',
        address_line2: '',
        city: isIndividual ? '' : 'Gondal',
        state: isIndividual ? '' : 'Gujarat',
        district: isIndividual ? '' : 'Rajkot',
        pincode: '',
        gstin: '',
        place_of_supply: '',
        payment_terms: isIndividual ? 'Immediate' : '',
      });
    }
  }, [customer, open, form, isIndividual, defaultName]);

  const handlePincodeLocationFetch = (locationData: LocationData) => {
    if (locationData.city) {
      form.setValue('city', locationData.city, { shouldValidate: true });
    }
    if (locationData.state) {
      form.setValue('state', locationData.state, { shouldValidate: true });
    }
  };

  const handleFormSubmit = (data: CustomerFormData) => {
    onSubmit({
      ...data,
      customer_type: effectiveType,
    });
  };

  const nameLabel = isIndividual ? 'Customer Name' : 'Company Name';
  const dialogTitle = customer
    ? `Edit ${isIndividual ? 'Individual' : 'Company'} Customer`
    : `Add New ${isIndividual ? 'Individual' : 'Company'} Customer`;
  const dialogDesc = customer
    ? 'Update customer information'
    : `Enter ${isIndividual ? 'individual' : 'company'} customer details`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company/Customer Name */}
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>{nameLabel} *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={`Enter ${nameLabel.toLowerCase()}`} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Client Name - only for company customers */}
              {!isIndividual && (
                <FormField
                  control={form.control}
                  name="client_name"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Client Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter client name (optional)" disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Contact */}
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter contact number" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email{!isIndividual ? ' *' : ''}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="Enter email address" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Line 1 */}
              <FormField
                control={form.control}
                name="address_line1"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Address Line 1{!isIndividual ? ' *' : ''}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter address line 1" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address Line 2 */}
              <FormField
                control={form.control}
                name="address_line2"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter address line 2 (optional)" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pincode with Auto-fill */}
              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Pincode{!isIndividual ? ' *' : ''}</FormLabel>
                    <FormControl>
                      <PincodeAutoFillField
                        value={field.value}
                        onChange={field.onChange}
                        onLocationFetch={handlePincodeLocationFetch}
                        disabled={isLoading}
                        required={!isIndividual}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Location Selector with State, District, City - Auto-filled from pincode */}
              <div className="col-span-full">
                <LocationSelector
                  control={form.control}
                  setValue={form.setValue}
                  requiredFields={isIndividual ? {} : { state: true, city: true }}
                  showFields={{ state: true, district: true, city: true }}
                  allowCustomValues={true}
                  layout="row"
                  disabled={isLoading}
                />
              </div>

              {/* GSTIN - only for company customers */}
              {!isIndividual && (
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter GSTIN (optional)" disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Place of Supply */}
              {!isIndividual && (
                <FormField
                  control={form.control}
                  name="place_of_supply"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Place of Supply{!isIndividual ? ' *' : ''}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 24-Gujarat" disabled={isLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Payment Terms */}
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem className="col-span-full">
                    <FormLabel>Payment Terms{!isIndividual ? ' *' : ''}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={isIndividual ? 'e.g., Immediate, Cash' : 'e.g., Net 30'} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : customer ? 'Update Customer' : 'Create Customer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
