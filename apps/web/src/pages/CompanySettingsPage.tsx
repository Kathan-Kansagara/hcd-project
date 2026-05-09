import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Save, Loader2, Landmark, FileText, MapPin, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import {
  companySettingsService,
  type UpdateCompanySettingsPayload,
} from '@/services/company-settings.service';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const companySettingsSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  address_line1: z.string().min(1, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  pincode: z
    .string()
    .min(6, 'Pincode must be 6 digits')
    .max(6, 'Pincode must be 6 digits')
    .regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  gstin: z
    .string()
    .min(15, 'GSTIN must be 15 characters')
    .max(15, 'GSTIN must be 15 characters')
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Invalid GSTIN format',
    ),
  bank_name: z.string().min(1, 'Bank name is required'),
  bank_account_number: z.string().min(1, 'Bank account number is required'),
  ifsc_code: z
    .string()
    .min(11, 'IFSC code must be 11 characters')
    .max(11, 'IFSC code must be 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
  invoice_terms_and_conditions: z.string().min(1, 'Invoice terms & conditions are required'),
  invoice_prefix: z.string().min(1, 'Invoice prefix is required'),
});

type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function CompanySettingsPage() {
  useBreadcrumbs([
    { label: 'Administration' },
    { label: 'Company Settings' },
  ]);

  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings, isLoading, isError } = useQuery({
    queryKey: ['company-settings'],
    queryFn: companySettingsService.getSettings,
  });

  const form = useForm<CompanySettingsFormValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      company_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      bank_name: '',
      bank_account_number: '',
      ifsc_code: '',
      invoice_terms_and_conditions: '',
      invoice_prefix: 'INV/',
    },
  });

  // Populate form when data is fetched
  useEffect(() => {
    if (settings) {
      form.reset({
        company_name: settings.company_name || '',
        address_line1: settings.address_line1 || '',
        address_line2: settings.address_line2 || '',
        city: settings.city || '',
        state: settings.state || '',
        pincode: settings.pincode || '',
        gstin: settings.gstin || '',
        bank_name: settings.bank_name || '',
        bank_account_number: settings.bank_account_number || '',
        ifsc_code: settings.ifsc_code || '',
        invoice_terms_and_conditions: settings.invoice_terms_and_conditions || '',
        invoice_prefix: settings.invoice_prefix || 'INV/',
      });
    }
  }, [settings, form]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateCompanySettingsPayload) =>
      companySettingsService.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Company settings updated successfully');
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.error || 'Failed to update company settings';
      toast.error(message);
    },
  });

  const onSubmit = (values: CompanySettingsFormValues) => {
    updateMutation.mutate(values);
  };

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive text-lg font-medium">
              Failed to load company settings
            </p>
            <p className="text-muted-foreground mt-1">
              Please check your permissions and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your company information, bank details, and invoice configuration.
            </p>
          </div>
        </div>
        <Button
          type="submit"
          form="company-settings-form"
          disabled={updateMutation.isPending || !form.formState.isDirty}
          className="w-full sm:w-auto"
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      <Separator />

      <Form {...form}>
        <form
          id="company-settings-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Information Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Company Information</CardTitle>
                </div>
                <CardDescription>
                  Basic details about your company that appear on invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter company name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. 27AAFCZ1234A1ZA"
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        15-character GST Identification Number
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Address Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Address</CardTitle>
                </div>
                <CardDescription>
                  Your company's registered address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address_line1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address Line 1</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} />
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
                        <Input
                          placeholder="Apartment, suite, etc. (optional)"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="State" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="pincode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pincode</FormLabel>
                      <FormControl>
                        <Input placeholder="6-digit pincode" maxLength={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Bank Details Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Bank Details</CardTitle>
                </div>
                <CardDescription>
                  Bank information displayed on invoices for payment collection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="bank_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. State Bank of India" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bank_account_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Bank account number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ifsc_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. SBIN0001234"
                          maxLength={11}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        11-character RTGS/NEFT IFSC code
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Invoice Configuration Card */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Invoice Configuration</CardTitle>
                </div>
                <CardDescription>
                  Settings that control invoice numbering and default content.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="invoice_prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. INV/" {...field} />
                      </FormControl>
                      <FormDescription>
                        Prefix added before invoice numbers (e.g. INV/0001)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          {/* Terms & Conditions - Full width */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Invoice Terms & Conditions</CardTitle>
              </div>
              <CardDescription>
                Default terms printed at the bottom of every invoice. Separate each term with a new line.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="invoice_terms_and_conditions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Enter terms & conditions (one per line)..."
                        className="min-h-[150px] resize-y"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bottom save button for convenience */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending || !form.formState.isDirty}
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
