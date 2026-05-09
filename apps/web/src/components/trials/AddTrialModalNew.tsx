import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Save, Plus, Trash2, Upload, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trialService } from '../../services/trial.service';
import { productService } from '../../services/product.service';
import { farmerService } from '../../services/farmer.service';
import { applicationService } from '../../services/application.service';
import { batchService } from '../../services/batch.service';
import { API_BASE_URL } from '../../lib/axios';
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
import { LocationFieldGroup } from '@/components/ui/location-field-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const applicationSchema = z.object({
  app_number: z.number().min(1, 'Application number is required'),
  app_type: z.enum(['DRIP', 'IRRIGATION', 'SPRAY']),
  start_date: z.date(),
  end_date: z.date().optional(),
  batch_id: z.string().optional(),
  quantity_used: z.number().min(0.5, 'Quantity used is required'),
  before_comments: z.string().optional(),
  after_comments: z.string().optional(),
  before_photos: z.array(z.instanceof(File)).optional(),
  after_photos: z.array(z.instanceof(File)).optional(),
});

const trialSchema = z.object({
  farmer_id: z.string().min(1, 'Farmer is required'),
  product_id: z.string().min(1, 'Product is required'),
  crop: z.string().min(1, 'Crop is required'),
  village: z.string().min(1, 'Village is required'),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  contact: z.string().optional(),
  season: z.string().optional(),
  start_date: z.date(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  with_other_products: z.string().optional(),
  applications: z.array(applicationSchema).optional(),
  yield_value: z.number().optional(),
  yield_unit: z.string().optional(),
  final_comments: z.string().optional(),
});

type TrialFormData = z.infer<typeof trialSchema>;

interface AddTrialModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  trialId?: string | null;
}

// Helper function to get full image URL
const getImageUrl = (relativePath: string) => {
  const baseUrl = API_BASE_URL.replace('/api/v1', '');
  return `${baseUrl}${relativePath}`;
};

// Helper function to check if file is a video
const isVideoFile = (url: string) => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.mpg'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
};

export default function AddTrialModalNew({ isOpen, onClose, trialId }: AddTrialModalNewProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [openAccordions, setOpenAccordions] = useState<string[]>([]);
  const [tempFarmerName, setTempFarmerName] = useState<string | null>(null);
  const [farmerOpen, setFarmerOpen] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSearch, setCropSearch] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [seasonSearch, setSeasonSearch] = useState('');
  const [existingPhotos, setExistingPhotos] = useState<Record<number, { before: any[], after: any[] }>>({});

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAll,
    enabled: isOpen,
  });

  const { data: farmers } = useQuery({
    queryKey: ['farmers'],
    queryFn: () => farmerService.getAll(),
    enabled: isOpen,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['trial-filter-options'],
    queryFn: trialService.getFilterOptions,
    enabled: isOpen,
    staleTime: 0, // Consider data stale immediately, but don't auto-refetch
  });


  const { data: existingTrial } = useQuery({
    queryKey: ['trial', trialId],
    queryFn: () => trialService.getById(trialId!),
    enabled: !!trialId && isOpen,
  });

  const form = useForm<TrialFormData>({
    resolver: zodResolver(trialSchema),
    defaultValues: {
      start_date: new Date(),
      season: '',
      with_other_products: '',
      applications: [],
      final_comments: '',
      contact: '',
    },
  });

  const selectedProductId = form.watch('product_id');
  const { data: batches } = useQuery({
    queryKey: ['batches', selectedProductId],
    queryFn: () => batchService.getAll({ product_id: selectedProductId, is_active: true }),
    enabled: isOpen && !!selectedProductId,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'applications',
  });

  // Auto-select oldest batch with available stock when batches are loaded or new application is added
  useEffect(() => {
    if (batches?.batches && batches.batches.length > 0 && fields.length > 0) {
      // Sort batches by manufacturing_date (oldest first) and filter those with available stock
      const batchesWithStock = batches.batches
        .filter((batch: any) => batch.quantity_remaining > 0)
        .sort((a: any, b: any) =>
          new Date(a.manufacturing_date).getTime() - new Date(b.manufacturing_date).getTime()
        );

      if (batchesWithStock.length > 0) {
        const oldestBatchId = batchesWithStock[0].id;

        // Auto-select the oldest batch for each application if not already set
        fields.forEach((field, index) => {
          const currentBatchId = form.getValues(`applications.${index}.batch_id`);
          // Only set if batch_id is not already set
          if (!currentBatchId) {
            form.setValue(`applications.${index}.batch_id`, oldestBatchId, { shouldValidate: false });
          }
        });
      }
    }
  }, [batches, fields.length, form]);

  // Populate form when editing or clear when creating new
  useEffect(() => {
    if (existingTrial && trialId) {
      const formData = {
        farmer_id: existingTrial.farmer_id,
        product_id: existingTrial.product_id,
        crop: existingTrial.crop,
        village: existingTrial.village,
        city: existingTrial.city || '',
        district: existingTrial.district || '',
        state: existingTrial.state || '',
        pincode: existingTrial.pincode || '',
        contact: existingTrial.farmer?.contact || '',
        season: existingTrial.season || '',
        start_date: new Date(existingTrial.start_date),
        gps_lat: existingTrial.gps_lat || undefined,
        gps_lng: existingTrial.gps_lng || undefined,
        with_other_products: existingTrial.with_other_products || '',
        yield_value: existingTrial.yield_value || undefined,
        yield_unit: existingTrial.yield_unit || '',
        final_comments: existingTrial.comments || '',
        applications: existingTrial.applications?.map((app: any) => ({
          app_number: app.app_number,
          app_type: app.app_type,
          start_date: new Date(app.app_date),
          end_date: app.end_date ? new Date(app.end_date) : undefined,
          batch_id: app.batch_id || undefined,
          quantity_used: app.quantity_used || 0.5,
          before_comments: app.before_comments || '',
          after_comments: app.after_comments || '',
          before_photos: [],
          after_photos: [],
        })) || [],
      };

      // Populate existing photos
      const photos: Record<number, { before: any[], after: any[] }> = {};
      existingTrial.applications?.forEach((app: any, index: number) => {
        photos[index] = {
          before: app.photos?.filter((p: any) => p.stage === 'BEFORE_UNTREATED') || [],
          after: app.photos?.filter((p: any) => p.stage === 'AFTER_TREATED') || [],
        };
      });
      setExistingPhotos(photos);

      form.reset(formData);
      // Trigger validation to ensure form is valid
      setTimeout(() => {
        form.trigger();
      }, 100);
    } else if (!trialId && isOpen) {
      // Clear existing photos when opening modal for new trial
      setExistingPhotos({});
    }
  }, [existingTrial, trialId, isOpen, form]);

  const handleDeletePhoto = async (appIndex: number, photoId: string, stage: 'before' | 'after') => {
    try {
      await applicationService.deletePhoto(photoId);
      setExistingPhotos(prev => ({
        ...prev,
        [appIndex]: {
          ...prev[appIndex],
          [stage]: prev[appIndex]?.[stage]?.filter(p => p.id !== photoId) || [],
        },
      }));
      toast.success('Photo deleted successfully');
    } catch (error) {
      toast.error('Failed to delete photo');
    }
  };

  const updateTrialMutation = useMutation({
    mutationFn: async (data: TrialFormData) => {
      if (!trialId) return;

      // Step 1: Update the trial basic info
      const trialData = {
        farmer_id: data.farmer_id,
        product_id: data.product_id,
        crop: data.crop,
        village: data.village,
        city: data.city,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        season: data.season,
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        gps_lat: data.gps_lat,
        gps_lng: data.gps_lng,
        with_other_products: data.with_other_products,
        yield_value: data.yield_value,
        yield_unit: data.yield_unit,
        final_comments: data.final_comments,
      };

      await trialService.update(trialId, trialData);

      // Step 2: Get existing applications for this trial
      const existingApps = existingTrial?.applications || [];
      const existingAppIds = new Set(existingApps.map((app: any) => app.id));

      // Step 3: Handle applications
      if (data.applications && data.applications.length > 0) {
        for (let i = 0; i < data.applications.length; i++) {
          const app = data.applications[i];
          const existingApp = existingApps[i]; // Match by index for now

          const appData = {
            trial_id: trialId,
            app_number: app.app_number,
            app_type: app.app_type,
            app_date: format(app.start_date, 'yyyy-MM-dd'),
            batch_id: app.batch_id,
            quantity_used: app.quantity_used,
            before_comments: app.before_comments,
            after_comments: app.after_comments,
          };

          // If there's an existing app at this index, update it; otherwise create new
          if (existingApp) {
            await applicationService.update(existingApp.id, appData);
            existingAppIds.delete(existingApp.id); // Mark as handled

            // Handle photo uploads for updated application
            if (app.before_photos && app.before_photos.length > 0) {
              for (const photo of app.before_photos) {
                await applicationService.uploadPhoto(existingApp.id, photo, 'BEFORE_UNTREATED');
              }
            }
            if (app.after_photos && app.after_photos.length > 0) {
              for (const photo of app.after_photos) {
                await applicationService.uploadPhoto(existingApp.id, photo, 'AFTER_TREATED');
              }
            }
          } else {
            // Create new application
            const createdApp = await applicationService.create(appData);

            // Handle photo uploads for new application
            if (app.before_photos && app.before_photos.length > 0) {
              for (const photo of app.before_photos) {
                await applicationService.uploadPhoto(createdApp.id, photo, 'BEFORE_UNTREATED');
              }
            }
            if (app.after_photos && app.after_photos.length > 0) {
              for (const photo of app.after_photos) {
                await applicationService.uploadPhoto(createdApp.id, photo, 'AFTER_TREATED');
              }
            }
          }
        }
      }

      // Step 4: Delete applications that were removed (remaining IDs in existingAppIds)
      for (const appId of existingAppIds) {
        await applicationService.delete(appId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['trial', trialId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trial-filter-options'] });
      toast.success('Trial updated successfully');
      handleClose();
    },
    onError: (error: any) => {
      console.error('Failed to update trial:', error);
      toast.error('Failed to update trial. Please try again.');
    },
  });

  const createTrialMutation = useMutation({
    mutationFn: async (data: TrialFormData) => {
      let farmerId = data.farmer_id;

      // Step 0: Create farmer if it's a temp farmer
      if (data.farmer_id === 'temp-new-farmer' && tempFarmerName) {
        const newFarmer = await farmerService.create({
          name: tempFarmerName,
          village: data.village,
          city: data.city,
          district: data.district,
          state: data.state,
          pincode: data.pincode,
        });
        farmerId = newFarmer.id;
      }

      // Step 1: Create the trial
      const trialData = {
        farmer_id: farmerId,
        product_id: data.product_id,
        crop: data.crop,
        village: data.village,
        city: data.city,
        district: data.district,
        state: data.state,
        pincode: data.pincode,
        season: data.season,
        start_date: format(data.start_date, 'yyyy-MM-dd'),
        gps_lat: data.gps_lat,
        gps_lng: data.gps_lng,
        with_other_products: data.with_other_products,
        yield_value: data.yield_value,
        yield_unit: data.yield_unit,
        final_comments: data.final_comments,
        status: 'IN_PROGRESS' as const,
      };
      const trial = await trialService.create(trialData);

      // Step 2: Create applications if any
      if (data.applications && data.applications.length > 0) {
        for (const app of data.applications) {
          const appData = {
            trial_id: trial.id,
            app_number: app.app_number,
            app_type: app.app_type,
            app_date: format(app.start_date, 'yyyy-MM-dd'), // Using start_date as app_date for now
            batch_id: app.batch_id,
            quantity_used: app.quantity_used,
            before_comments: app.before_comments,
            after_comments: app.after_comments,
          };
          const createdApp = await applicationService.create(appData);

          // Step 3: Upload photos for this application
          if (app.before_photos && app.before_photos.length > 0) {
            for (const photo of app.before_photos) {
              await applicationService.uploadPhoto(createdApp.id, photo, 'BEFORE_UNTREATED');
            }
          }
          if (app.after_photos && app.after_photos.length > 0) {
            for (const photo of app.after_photos) {
              await applicationService.uploadPhoto(createdApp.id, photo, 'AFTER_TREATED');
            }
          }
        }
      }

      return trial;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trials'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['trial-filter-options'] });
      toast.success('Trial created successfully');
      handleClose();
    },
    onError: (error: any) => {
      console.error('Failed to create trial:', error);
      toast.error('Failed to create trial. Please try again.');
    },
  });

  const handleClose = () => {
    form.reset({
      start_date: new Date(),
      season: '',
      with_other_products: '',
      applications: [],
      final_comments: '',
      farmer_id: undefined,
      product_id: undefined,
      crop: undefined,
      village: undefined,
      city: '',
      district: '',
      state: '',
      pincode: '',
      contact: '',
      gps_lat: undefined,
      gps_lng: undefined,
      yield_value: undefined,
      yield_unit: '',
    });
    setCurrentStep(1);
    setTempFarmerName(null);
    setExistingPhotos({});
    onClose();
  };

  const handleFarmerSelect = (farmer: any) => {
    form.setValue('farmer_id', farmer.id);
    form.setValue('village', farmer.village);
    form.setValue('city', farmer.city || '');
    form.setValue('district', farmer.district || '');
    form.setValue('state', farmer.state || '');
    form.setValue('pincode', farmer.pincode || '');
    form.setValue('contact', farmer.contact || '');
  };

  const handleVillageSelect = async (villageName: string) => {
    form.setValue('village', villageName);
    // Fetch location details for this village
    try {
      const response = await farmerService.getLocationDetails(villageName);
      if (response?.location) {
        form.setValue('city', response.location.city || '');
        form.setValue('district', response.location.district || '');
        form.setValue('state', response.location.state || '');
        form.setValue('pincode', response.location.pincode || '');
      }
    } catch (error) {
      console.error('Failed to fetch location details:', error);
    }
  };

  const onSubmit = (data: TrialFormData) => {
    if (currentStep === 1) {
      // Validate basic info before moving to step 2
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Can skip applications and go to step 3
      setCurrentStep(3);
    } else {
      // Step 3 - final submit
      if (trialId) {
        updateTrialMutation.mutate(data);
      } else {
        createTrialMutation.mutate(data);
      }
    }
  };

  const productOptions = (products as any)?.products || [];
  const farmerOptions = (farmers as any)?.farmers || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div>
              <DialogTitle>{trialId ? 'Edit Trial' : 'Add New Trial'}</DialogTitle>
              <DialogDescription>
                {trialId ? 'Edit the crop trial by following the steps below' : 'Create a new crop trial by following the steps below'}
              </DialogDescription>
            </div>
            <Button
              type="submit"
              disabled={createTrialMutation.isPending || updateTrialMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              }}
              className="shrink-0"
            >
              {currentStep < 3 ? (
                <>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {trialId
                    ? (updateTrialMutation.isPending ? 'Updating...' : 'Update Trial')
                    : (createTrialMutation.isPending ? 'Creating...' : 'Create Trial')}
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between py-4 border-y">
          {[
            { num: 1, label: 'Basic Info' },
            { num: 2, label: 'Applications' },
            { num: 3, label: 'Final Details' },
          ].map((step, index) => (
            <div key={step.num} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => setCurrentStep(step.num)}
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0',
                    currentStep >= step.num
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.num}
                </div>
                <span
                  className={cn(
                    'ml-2 text-xs sm:text-sm font-medium hidden sm:inline',
                    currentStep >= step.num ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {index < 2 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 sm:mx-4',
                    currentStep > step.num ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 1: Basic Information</h3>

                  <FormField
                    control={form.control}
                    name="product_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {productOptions.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="farmer_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Farmer *</FormLabel>
                        <Popover open={farmerOpen} onOpenChange={setFarmerOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={farmerOpen}
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value === 'temp-new-farmer'
                                  ? tempFarmerName
                                  : field.value
                                  ? farmerOptions.find((f: any) => f.id === field.value)?.name
                                  : 'Select a farmer'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search farmer..."
                                value={farmerSearch}
                                onValueChange={setFarmerSearch}
                              />
                              <CommandList>
                                {farmerSearch && (
                                  <CommandEmpty>
                                    <div className="py-2 text-center text-sm">
                                      Press Enter to add "{farmerSearch}"
                                    </div>
                                  </CommandEmpty>
                                )}
                                <CommandGroup>
                                  {farmerOptions.map((farmer: any) => (
                                    <CommandItem
                                      key={farmer.id}
                                      value={`${farmer.name} ${farmer.village}`}
                                      onSelect={() => {
                                        handleFarmerSelect(farmer);
                                        setTempFarmerName(null);
                                        setFarmerOpen(false);
                                        setFarmerSearch('');
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          field.value === farmer.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {farmer.name} - {farmer.village}
                                    </CommandItem>
                                  ))}
                                  {farmerSearch &&
                                    !farmerOptions.some((f: any) => f.name.toLowerCase() === farmerSearch.toLowerCase()) && (
                                      <CommandItem
                                        value={farmerSearch}
                                        onSelect={(value) => {
                                          setTempFarmerName(value);
                                          field.onChange('temp-new-farmer');
                                          setFarmerOpen(false);
                                          setFarmerSearch('');
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add "{farmerSearch}"
                                      </CommandItem>
                                    )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., +91 98765 43210" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Location Fields */}
                  <LocationFieldGroup
                    control={form.control}
                    setValue={form.setValue}
                    requiredFields={{ village: true }}
                    enableVillageAutofill={true}
                  />

                  {/* Crop - Full Width */}
                  <FormField
                    control={form.control}
                    name="crop"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Crop *</FormLabel>
                        <Popover open={cropOpen} onOpenChange={setCropOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={cropOpen}
                                className={cn(
                                  'w-full justify-between font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value || 'Select or type crop...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                            <Command>
                              <CommandInput
                                placeholder="Search or type crop..."
                                value={cropSearch}
                                onValueChange={setCropSearch}
                              />
                              <CommandList>
                                {cropSearch && (
                                  <CommandEmpty>
                                    <div className="py-2 text-center text-sm">
                                      Press Enter to add "{cropSearch}"
                                    </div>
                                  </CommandEmpty>
                                )}
                                <CommandGroup>
                                  {filterOptions?.crops?.map((crop) => (
                                    <CommandItem
                                      key={crop}
                                      value={crop}
                                      onSelect={(value) => {
                                        field.onChange(value);
                                        setCropOpen(false);
                                        setCropSearch('');
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          'mr-2 h-4 w-4',
                                          field.value === crop ? 'opacity-100' : 'opacity-0'
                                        )}
                                      />
                                      {crop}
                                    </CommandItem>
                                  ))}
                                  {cropSearch &&
                                    !filterOptions?.crops?.some((c) => c.toLowerCase() === cropSearch.toLowerCase()) && (
                                      <CommandItem
                                        value={cropSearch}
                                        onSelect={(value) => {
                                          field.onChange(value);
                                          // Optimistically update the filter options
                                          queryClient.setQueryData(['trial-filter-options'], (old: any) => ({
                                            ...old,
                                            crops: [...(old?.crops || []), value],
                                          }));
                                          setCropOpen(false);
                                          setCropSearch('');
                                        }}
                                      >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add "{cropSearch}"
                                      </CommandItem>
                                    )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="season"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season</FormLabel>
                          <Popover open={seasonOpen} onOpenChange={setSeasonOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={seasonOpen}
                                  className={cn(
                                    'w-full justify-between font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value || 'Select or type season...'}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                <CommandInput
                                  placeholder="Search or type season..."
                                  value={seasonSearch}
                                  onValueChange={setSeasonSearch}
                                />
                                <CommandList>
                                  {seasonSearch && (
                                    <CommandEmpty>
                                      <div className="py-2 text-center text-sm">
                                        Press Enter to add "{seasonSearch}"
                                      </div>
                                    </CommandEmpty>
                                  )}
                                  <CommandGroup>
                                    {filterOptions?.seasons?.map((season) => (
                                      <CommandItem
                                        key={season}
                                        value={season}
                                        onSelect={(value) => {
                                          field.onChange(value);
                                          setSeasonOpen(false);
                                          setSeasonSearch('');
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            'mr-2 h-4 w-4',
                                            field.value === season ? 'opacity-100' : 'opacity-0'
                                          )}
                                        />
                                        {season}
                                      </CommandItem>
                                    ))}
                                    {seasonSearch &&
                                      !filterOptions?.seasons?.some((s) => s.toLowerCase() === seasonSearch.toLowerCase()) && (
                                        <CommandItem
                                          value={seasonSearch}
                                          onSelect={(value) => {
                                            field.onChange(value);
                                            // Optimistically update the filter options
                                            queryClient.setQueryData(['trial-filter-options'], (old: any) => ({
                                              ...old,
                                              seasons: [...(old?.seasons || []), value],
                                            }));
                                            setSeasonOpen(false);
                                            setSeasonSearch('');
                                          }}
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Add "{seasonSearch}"
                                        </CommandItem>
                                      )}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP')
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="gps_lat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPS Latitude</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="e.g., 28.7041"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gps_lng"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GPS Longitude</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="e.g., 77.1025"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="with_other_products"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Used with Other Products</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Product X, Product Y" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Step 2: Applications</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newIndex = fields.length;
                        append({
                          app_number: fields.length + 1,
                          app_type: 'SPRAY',
                          start_date: new Date(),
                          end_date: undefined,
                          quantity_used: 5,
                          before_comments: '',
                          after_comments: '',
                          before_photos: [],
                          after_photos: [],
                        });
                        // Auto-expand the newly added application
                        setTimeout(() => {
                          setOpenAccordions([...openAccordions, `app-${newIndex}`]);
                        }, 0);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Application
                    </Button>
                  </div>

                  {fields.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>No applications added yet. Click "Add Application" to create one.</p>
                      <p className="text-sm mt-1">(Optional - you can skip this step)</p>
                    </div>
                  ) : (
                    <Accordion
                      type="multiple"
                      className="space-y-2"
                      value={openAccordions}
                      onValueChange={setOpenAccordions}
                    >
                      {fields.map((field, index) => {
                        const appNumber = form.watch(`applications.${index}.app_number`) || index + 1;
                        const startDate = form.watch(`applications.${index}.start_date`);
                        const endDate = form.watch(`applications.${index}.end_date`);
                        const effectiveEndDate = endDate || new Date();

                        let statusText = '';
                        if (startDate) {
                          const diffTime = Math.abs(effectiveEndDate.getTime() - startDate.getTime());
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          const status = endDate ? 'completed' : 'running';
                          const dayLabel = diffDays === 1 ? 'day' : 'days';
                          statusText = `${diffDays} ${dayLabel} ${status}`;
                        }

                        return (
                          <AccordionItem key={field.id} value={`app-${index}`} className="border rounded-lg">
                            <div className="flex items-center pr-4">
                              <AccordionTrigger className="flex-1 hover:no-underline px-4">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <span className="font-medium">Application #{appNumber}</span>
                                  {statusText && (
                                    <span className="text-sm text-primary font-semibold">
                                      ({statusText})
                                    </span>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="shrink-0"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <AccordionContent className="px-4 pb-4 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.app_number`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>App Number *</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          {...field}
                                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.app_type`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Type *</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="DRIP">Drip</SelectItem>
                                          <SelectItem value="IRRIGATION">Irrigation</SelectItem>
                                          <SelectItem value="SPRAY">Spray</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.start_date`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Start Date *</FormLabel>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <FormControl>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                'w-full pl-3 text-left font-normal',
                                                !field.value && 'text-muted-foreground'
                                              )}
                                            >
                                              {field.value ? (
                                                format(field.value, 'PPP')
                                              ) : (
                                                <span>Pick date</span>
                                              )}
                                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                          </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.end_date`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>End Date (Optional)</FormLabel>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <FormControl>
                                            <Button
                                              variant="outline"
                                              className={cn(
                                                'w-full pl-3 text-left font-normal',
                                                !field.value && 'text-muted-foreground'
                                              )}
                                            >
                                              {field.value ? (
                                                format(field.value, 'PPP')
                                              ) : (
                                                <span>Pick date</span>
                                              )}
                                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                          </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Batch and Quantity */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.batch_id`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Batch (Optional)</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={!batches?.batches || batches.batches.length === 0}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder={batches?.batches?.length ? "Select batch" : "No batches available"} />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          {batches?.batches?.map((batch: any) => (
                                            <SelectItem key={batch.id} value={batch.id}>
                                              {batch.batch_number} ({batch.quantity_remaining} {batch.unit} left)
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`applications.${index}.quantity_used`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Quantity Used *</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.5"
                                          min="0.5"
                                          placeholder="e.g., 5"
                                          {...field}
                                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                          value={field.value ?? ''}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>

                              {/* Photos and Comments in 2 columns */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Before Column */}
                                <div className="flex flex-col">
                                  <h5 className="font-medium text-sm mb-4">Before (Untreated)</h5>

                                  <div className="flex-1">
                                    <FormField
                                      control={form.control}
                                      name={`applications.${index}.before_photos`}
                                      render={({ field: { onChange, value } }) => (
                                        <FormItem>
                                          <FormLabel>Photos</FormLabel>
                                          <div className="space-y-2">
                                            {/* Upload new photos (multiple) */}
                                            <div>
                                              <input
                                                type="file"
                                                accept="image/*,video/*"
                                                multiple
                                                onChange={(e) => {
                                                  const files = e.target.files ? Array.from(e.target.files) : [];
                                                  onChange(files);
                                                }}
                                                className="hidden"
                                                id={`before-photo-${index}`}
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => document.getElementById(`before-photo-${index}`)?.click()}
                                              >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Choose Files
                                              </Button>
                                              {value && value.length > 0 && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {value.length} file{value.length > 1 ? 's' : ''} selected
                                                </p>
                                              )}
                                            </div>
                                            {/* Display existing photos */}
                                            {existingPhotos[index]?.before && existingPhotos[index].before.length > 0 && (
                                              <div className="grid grid-cols-2 gap-2">
                                                {existingPhotos[index].before.map((photo: any) => {
                                                  const fileUrl = getImageUrl(photo.file_url);
                                                  const isVideo = isVideoFile(fileUrl);

                                                  return (
                                                    <div key={photo.id} className="relative group">
                                                      {isVideo ? (
                                                        <video
                                                          src={fileUrl}
                                                          className="w-full h-24 object-cover rounded border"
                                                          controls
                                                        />
                                                      ) : (
                                                        <img
                                                          src={fileUrl}
                                                          alt="Before"
                                                          className="w-full h-24 object-cover rounded border"
                                                        />
                                                      )}
                                                      <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeletePhoto(index, photo.id, 'before')}
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="mt-4">
                                    <FormField
                                      control={form.control}
                                      name={`applications.${index}.before_comments`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Comments</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              rows={3}
                                              placeholder="Observations before application..."
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>

                                {/* After Column */}
                                <div className="flex flex-col">
                                  <h5 className="font-medium text-sm mb-4">After (Treated)</h5>

                                  <div className="flex-1">
                                    <FormField
                                      control={form.control}
                                      name={`applications.${index}.after_photos`}
                                      render={({ field: { onChange, value } }) => (
                                        <FormItem>
                                          <FormLabel>Photos</FormLabel>
                                          <div className="space-y-2">
                                            {/* Upload new photos (multiple) */}
                                            <div>
                                              <input
                                                type="file"
                                                accept="image/*,video/*"
                                                multiple
                                                onChange={(e) => {
                                                  const files = e.target.files ? Array.from(e.target.files) : [];
                                                  onChange(files);
                                                }}
                                                className="hidden"
                                                id={`after-photo-${index}`}
                                              />
                                              <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => document.getElementById(`after-photo-${index}`)?.click()}
                                              >
                                                <Upload className="mr-2 h-4 w-4" />
                                                Choose Files
                                              </Button>
                                              {value && value.length > 0 && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                  {value.length} file{value.length > 1 ? 's' : ''} selected
                                                </p>
                                              )}
                                            </div>
                                            {/* Display existing photos */}
                                            {existingPhotos[index]?.after && existingPhotos[index].after.length > 0 && (
                                              <div className="grid grid-cols-2 gap-2">
                                                {existingPhotos[index].after.map((photo: any) => {
                                                  const fileUrl = getImageUrl(photo.file_url);
                                                  const isVideo = isVideoFile(fileUrl);

                                                  return (
                                                    <div key={photo.id} className="relative group">
                                                      {isVideo ? (
                                                        <video
                                                          src={fileUrl}
                                                          className="w-full h-24 object-cover rounded border"
                                                          controls
                                                        />
                                                      ) : (
                                                        <img
                                                          src={fileUrl}
                                                          alt="After"
                                                          className="w-full h-24 object-cover rounded border"
                                                        />
                                                      )}
                                                      <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeletePhoto(index, photo.id, 'after')}
                                                      >
                                                        <Trash2 className="h-3 w-3" />
                                                      </Button>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <div className="mt-4">
                                    <FormField
                                      control={form.control}
                                      name={`applications.${index}.after_comments`}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Comments</FormLabel>
                                          <FormControl>
                                            <Textarea
                                              rows={3}
                                              placeholder="Observations after application..."
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Step 3: Final Details</h3>

                  <FormField
                    control={form.control}
                    name="final_comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Final Comments</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            placeholder="Overall observations and conclusions..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
