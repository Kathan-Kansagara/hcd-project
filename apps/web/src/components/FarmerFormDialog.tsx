import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { farmerService } from '../services/farmer.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocationFieldGroup } from '@/components/ui/location-field-group';

const farmerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  village: z.string().min(1, 'Village is required'),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  contact: z.string()
    .optional()
    .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
      message: 'Phone number must be a valid 10-digit Indian mobile number',
    }),
});

type FarmerFormData = z.infer<typeof farmerSchema>;

interface FarmerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  farmerId?: string | null;
}

export default function FarmerFormDialog({ isOpen, onClose, farmerId }: FarmerFormDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FarmerFormData>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      name: '',
      village: '',
      city: 'Gondal',
      district: 'Rajkot',
      state: 'Gujarat',
      pincode: '',
      contact: '',
    },
  });

  const { data: existingFarmer } = useQuery({
    queryKey: ['farmer', farmerId],
    queryFn: () => farmerService.getById(farmerId!),
    enabled: !!farmerId && isOpen,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingFarmer && farmerId) {
      form.reset({
        name: existingFarmer.name,
        village: existingFarmer.village || '',
        city: existingFarmer.city || '',
        district: existingFarmer.district || '',
        state: existingFarmer.state || '',
        pincode: existingFarmer.pincode || '',
        contact: existingFarmer.contact || '',
      });
    } else if (!farmerId) {
      form.reset({
        name: '',
        village: '',
        city: 'Gondal',
        district: 'Rajkot',
        state: 'Gujarat',
        pincode: '',
        contact: '',
      });
    }
  }, [existingFarmer, farmerId, form]);

  const createMutation = useMutation({
    mutationFn: farmerService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-villages'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-cities'] });
      toast.success('Farmer created successfully');
      handleClose();
    },
    onError: () => {
      toast.error('Failed to create farmer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FarmerFormData> }) =>
      farmerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farmers'] });
      queryClient.invalidateQueries({ queryKey: ['farmer', farmerId] });
      queryClient.invalidateQueries({ queryKey: ['farmer-villages'] });
      queryClient.invalidateQueries({ queryKey: ['farmer-cities'] });
      toast.success('Farmer updated successfully');
      handleClose();
    },
    onError: () => {
      toast.error('Failed to update farmer');
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: FarmerFormData) => {
    if (farmerId) {
      updateMutation.mutate({ id: farmerId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{farmerId ? 'Edit Farmer' : 'Add New Farmer'}</DialogTitle>
          <DialogDescription>
            {farmerId ? 'Update farmer information' : 'Create a new farmer record'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ramesh Patel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact */}
            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., +91 98765 43210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location Fields using LocationFieldGroup */}
            <div className="space-y-4">
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Location Details</h3>
                <LocationFieldGroup
                  control={form.control}
                  setValue={form.setValue}
                  requiredFields={{ village: true }}
                  enableVillageAutofill
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : farmerId
                  ? 'Update Farmer'
                  : 'Create Farmer'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
