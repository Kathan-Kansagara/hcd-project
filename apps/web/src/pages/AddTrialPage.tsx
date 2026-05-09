import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, Check, ChevronsUpDown } from 'lucide-react';
import Layout from '../components/layout/Layout';
import PhotoUpload from '../components/trials/PhotoUpload';
import { trialService } from '../services/trial.service';
import { applicationService } from '../services/application.service';
import { productService } from '../services/product.service';
import { farmerService } from '../services/farmer.service';
import { batchService } from '../services/batch.service';
import type { Photo, Farmer } from '../types';
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
import { cn } from '@/lib/utils';

const trialSchema = z.object({
  farmer_id: z.string().min(1, 'Farmer is required'),
  product_id: z.string().min(1, 'Product is required'),
  crop: z.string().min(1, 'Crop is required'),
  village: z.string().min(1, 'Village is required'),
  season: z.string().optional(),
  start_date: z.string().min(1, 'Start date is required')
    .refine((date) => {
      const selectedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate <= today;
    }, {
      message: 'Start date cannot be in the future',
    }),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  with_other_products: z.string().optional(),
  applications: z.array(
    z.object({
      app_number: z.number(),
      app_type: z.enum(['DRIP', 'IRRIGATION', 'SPRAY']),
      app_date: z.string().min(1, 'Application date is required'),
      app_end_date: z.string().optional(),
      batch_id: z.string().optional(),
      quantity_used: z.string().optional(),
      before_comments: z.string().optional(),
      after_comments: z.string().optional(),
    })
  ).superRefine((applications, ctx) => {
    applications.forEach((app, index) => {
      if (app.app_end_date && app.app_date) {
        const startDate = new Date(app.app_date);
        const endDate = new Date(app.app_end_date);
        if (endDate <= startDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'End date must be greater than start date',
            path: [index, 'app_end_date'],
          });
        }
      }
    });
  }),
  yield_value: z.number().optional(),
  yield_unit: z.string().optional(),
  final_comments: z.string().optional(),
});

type TrialFormData = z.infer<typeof trialSchema>;

export default function AddTrialPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [createdTrialId, setCreatedTrialId] = useState<string | null>(null);
  const [applicationPhotos, setApplicationPhotos] = useState<Record<number, Photo[]>>({});

  // Combobox states
  const [farmerOpen, setFarmerOpen] = useState(false);
  const [farmerSearch, setFarmerSearch] = useState('');
  const [villageOpen, setVillageOpen] = useState(false);
  const [villageSearch, setVillageSearch] = useState('');
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [seasonSearch, setSeasonSearch] = useState('');
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSearch, setCropSearch] = useState('');

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: productService.getAll,
  });

  const { data: farmerData } = useQuery({
    queryKey: ['farmers'],
    queryFn: () => farmerService.getAll(),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['trial-filter-options'],
    queryFn: trialService.getFilterOptions,
  });

  const { data: villages } = useQuery({
    queryKey: ['farmer-villages'],
    queryFn: () => farmerService.getLocations('village'),
  });

  const farmers = farmerData?.farmers || [];

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TrialFormData>({
    resolver: zodResolver(trialSchema),
    defaultValues: {
      start_date: format(new Date(), 'yyyy-MM-dd'),
      applications: [
        {
          app_number: 1,
          app_type: 'SPRAY',
          app_date: format(new Date(), 'yyyy-MM-dd'),
          quantity_used: '5', // Default quantity
        },
      ],
    },
  });

  // Watch product_id to fetch batches
  const selectedProductId = watch('product_id');

  // Fetch available batches for the selected product
  const { data: batchesData } = useQuery({
    queryKey: ['product-batches', selectedProductId],
    queryFn: () => batchService.getByProduct(selectedProductId),
    enabled: !!selectedProductId,
  });

  const availableBatches = batchesData?.batches || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'applications',
  });

  // Auto-select oldest batch with available stock when batches are loaded or new application is added
  useEffect(() => {
    if (availableBatches.length > 0 && fields.length > 0) {
      // Sort batches by manufacturing_date (oldest first) and filter those with available stock
      const batchesWithStock = availableBatches
        .filter((batch: any) => batch.quantity_remaining > 0)
        .sort((a: any, b: any) =>
          new Date(a.manufacturing_date).getTime() - new Date(b.manufacturing_date).getTime()
        );

      // Auto-select the oldest batch for each application if not already set
      if (batchesWithStock.length > 0) {
        const oldestBatchId = batchesWithStock[0].id;
        fields.forEach((field, index) => {
          const currentBatchId = getValues(`applications.${index}.batch_id`);
          // Check if batch_id is not already set
          if (!currentBatchId) {
            setValue(`applications.${index}.batch_id`, oldestBatchId, { shouldValidate: false });
          }
        });
      }
    }
  }, [availableBatches, fields, setValue, getValues]);

  // Auto-fill location details when farmer is selected
  const handleFarmerSelect = (farmer: Farmer) => {
    setValue('farmer_id', farmer.id);
    setValue('village', farmer.village);
  };

  const createTrialMutation = useMutation({
    mutationFn: trialService.create,
    onSuccess: (trial) => {
      setCreatedTrialId(trial.id);
      setCurrentStep(2);
    },
  });

  const createApplicationMutation = useMutation({
    mutationFn: applicationService.create,
  });

  // const uploadPhotoMutation = useMutation({
  //   mutationFn: ({
  //     applicationId,
  //     file,
  //     stage,
  //   }: {
  //     applicationId: string;
  //     file: File;
  //     stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED';
  //   }) => applicationService.uploadPhoto(applicationId, file, stage),
  // });

  // const deletePhotoMutation = useMutation({
  //   mutationFn: applicationService.deletePhoto,
  // });

  const onSubmitStep1 = async (data: TrialFormData) => {
    const trialData = {
      farmer_id: data.farmer_id,
      product_id: data.product_id,
      crop: data.crop,
      village: data.village,
      season: data.season,
      start_date: data.start_date,
      gps_lat: data.gps_lat,
      gps_lng: data.gps_lng,
      with_other_products: data.with_other_products,
      status: 'DRAFT' as const,
    };
    createTrialMutation.mutate(trialData);
  };

  const onSubmitStep2 = async (data: TrialFormData) => {
    if (!createdTrialId) return;

    // Create applications
    for (const app of data.applications) {
      await createApplicationMutation.mutateAsync({
        trial_id: createdTrialId,
        ...app,
      });
    }

    setCurrentStep(3);
  };

  const onSubmitStep3 = async (data: TrialFormData) => {
    if (!createdTrialId) return;

    // Update trial with yield and final comments
    await trialService.update(createdTrialId, {
      yield_value: data.yield_value,
      yield_unit: data.yield_unit,
      comments: data.final_comments,
      status: 'IN_PROGRESS',
    });

    queryClient.invalidateQueries({ queryKey: ['trials'] });
    navigate('/trials');
  };

  const handlePhotoUpload = async (
    appIndex: number,
    file: File,
    stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED'
  ) => {
    // For now, just store locally until application is created
    // In step 2, we'll upload after creating applications
    const mockPhoto: Photo = {
      id: `temp-${Date.now()}`,
      application_id: `temp-app-${appIndex}`,
      stage,
      file_url: URL.createObjectURL(file),
      file_size: file.size,
      created_by: '',
      created_at: new Date().toISOString(),
    };

    setApplicationPhotos((prev) => ({
      ...prev,
      [appIndex]: [...(prev[appIndex] || []), mockPhoto],
    }));
  };

  const handlePhotoDelete = (appIndex: number, photoId: string) => {
    setApplicationPhotos((prev) => ({
      ...prev,
      [appIndex]: (prev[appIndex] || []).filter((p) => p.id !== photoId),
    }));
  };

  // const formData = watch();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New Trial</h1>
          <p className="mt-2 text-gray-600">
            Create a new crop trial by following the steps below
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Basic Info' },
              { num: 2, label: 'Applications' },
              { num: 3, label: 'Outcome' },
            ].map((step, index) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep >= step.num
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step.num}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      currentStep >= step.num ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {index < 2 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step.num ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {currentStep === 1 && (
            <form onSubmit={handleSubmit(onSubmitStep1)} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Step 1: Basic Information
              </h2>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('product_id')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a product</option>
                  {(products?.data || []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {errors.product_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.product_id.message}</p>
                )}
              </div>

              {/* Farmer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farmer <span className="text-red-500">*</span>
                </label>
                <Controller
                  control={control}
                  name="farmer_id"
                  render={({ field }) => (
                    <Popover open={farmerOpen} onOpenChange={setFarmerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={farmerOpen}
                          className={cn(
                            'w-full justify-between font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value
                            ? farmers.find((f: Farmer) => f.id === field.value)?.name
                            : 'Select farmer...'}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                        <Command>
                          <CommandInput
                            placeholder="Search farmer..."
                            value={farmerSearch}
                            onValueChange={setFarmerSearch}
                          />
                          <CommandList>
                            <CommandEmpty>No farmer found.</CommandEmpty>
                            <CommandGroup>
                              {farmers.map((farmer: Farmer) => (
                                <CommandItem
                                  key={farmer.id}
                                  value={`${farmer.name} ${farmer.village}`}
                                  onSelect={() => {
                                    handleFarmerSelect(farmer);
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
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.farmer_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.farmer_id.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Crop */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Crop <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    control={control}
                    name="crop"
                    render={({ field }) => (
                      <Popover open={cropOpen} onOpenChange={setCropOpen}>
                        <PopoverTrigger asChild>
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
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or type crop..."
                              value={cropSearch}
                              onValueChange={setCropSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="py-2 text-center text-sm">
                                  Press Enter to add "{cropSearch}"
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {filterOptions?.crops.map((crop) => (
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
                                  !filterOptions?.crops.some((c) => c.toLowerCase() === cropSearch.toLowerCase()) && (
                                    <CommandItem
                                      value={cropSearch}
                                      onSelect={(value) => {
                                        field.onChange(value);
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
                    )}
                  />
                  {errors.crop && (
                    <p className="text-red-500 text-sm mt-1">{errors.crop.message}</p>
                  )}
                </div>

                {/* Village */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Village <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    control={control}
                    name="village"
                    render={({ field }) => (
                      <Popover open={villageOpen} onOpenChange={setVillageOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={villageOpen}
                            className={cn(
                              'w-full justify-between font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value || 'Select or type village...'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or type village..."
                              value={villageSearch}
                              onValueChange={setVillageSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="py-2 text-center text-sm">
                                  Press Enter to add "{villageSearch}"
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {villages?.map((village) => (
                                  <CommandItem
                                    key={village}
                                    value={village}
                                    onSelect={(value) => {
                                      field.onChange(value);
                                      setVillageOpen(false);
                                      setVillageSearch('');
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        field.value === village ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    {village}
                                  </CommandItem>
                                ))}
                                {villageSearch &&
                                  !villages?.some((v) => v.toLowerCase() === villageSearch.toLowerCase()) && (
                                    <CommandItem
                                      value={villageSearch}
                                      onSelect={(value) => {
                                        field.onChange(value);
                                        setVillageOpen(false);
                                        setVillageSearch('');
                                      }}
                                    >
                                      <Plus className="mr-2 h-4 w-4" />
                                      Add "{villageSearch}"
                                    </CommandItem>
                                  )}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                  {errors.village && (
                    <p className="text-red-500 text-sm mt-1">{errors.village.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Season */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                  <Controller
                    control={control}
                    name="season"
                    render={({ field }) => (
                      <Popover open={seasonOpen} onOpenChange={setSeasonOpen}>
                        <PopoverTrigger asChild>
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
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search or type season..."
                              value={seasonSearch}
                              onValueChange={setSeasonSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <div className="py-2 text-center text-sm">
                                  Press Enter to add "{seasonSearch}"
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                {filterOptions?.seasons.map((season) => (
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
                                  !filterOptions?.seasons.some((s) => s.toLowerCase() === seasonSearch.toLowerCase()) && (
                                    <CommandItem
                                      value={seasonSearch}
                                      onSelect={(value) => {
                                        field.onChange(value);
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
                    )}
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('start_date')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.start_date && (
                    <p className="text-red-500 text-sm mt-1">{errors.start_date.message}</p>
                  )}
                </div>
              </div>

              {/* GPS Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GPS Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('gps_lat', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 28.7041"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GPS Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('gps_lng', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 77.1025"
                  />
                </div>
              </div>

              {/* Other Products */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Used with Other Products
                </label>
                <input
                  type="text"
                  {...register('with_other_products')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Product X, Product Y"
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={createTrialMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center disabled:opacity-50"
                >
                  {createTrialMutation.isPending ? 'Creating...' : 'Next'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {currentStep === 2 && (
            <form onSubmit={handleSubmit(onSubmitStep2)} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Step 2: Applications & Photos
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      app_number: fields.length + 1,
                      app_type: 'SPRAY',
                      app_date: format(new Date(), 'yyyy-MM-dd'),
                      quantity_used: '5',
                    })
                  }
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center text-sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Application
                </button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="border border-gray-200 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">
                      Application #{index + 1}
                    </h3>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700 flex items-center text-sm"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Application Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        {...register(`applications.${index}.app_type`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="SPRAY">Spray</option>
                        <option value="DRIP">Drip</option>
                        <option value="IRRIGATION">Irrigation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Application Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        {...register(`applications.${index}.app_date`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {errors.applications?.[index]?.app_date && (
                        <p className="text-red-500 text-sm mt-1">
                          {errors.applications[index]?.app_date?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Batch Number
                      </label>
                      <select
                        {...register(`applications.${index}.batch_id`)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!selectedProductId}
                      >
                        <option value="">Select batch (optional)</option>
                        {availableBatches.map((batch: any) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batch_number} - {batch.quantity_remaining} {batch.unit} remaining
                          </option>
                        ))}
                      </select>
                      {!selectedProductId && (
                        <p className="text-xs text-gray-500 mt-1">
                          Select a product first to see batches
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity Used
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register(`applications.${index}.quantity_used`)}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <PhotoUpload
                      stage="BEFORE_UNTREATED"
                      photos={applicationPhotos[index] || []}
                      onUpload={(file, stage) => handlePhotoUpload(index, file, stage)}
                      onDelete={(photoId) => handlePhotoDelete(index, photoId)}
                      label="Before (Untreated) Photos"
                    />

                    <PhotoUpload
                      stage="AFTER_TREATED"
                      photos={applicationPhotos[index] || []}
                      onUpload={(file, stage) => handlePhotoUpload(index, file, stage)}
                      onDelete={(photoId) => handlePhotoDelete(index, photoId)}
                      label="After (Treated) Photos"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Before Comments
                      </label>
                      <textarea
                        {...register(`applications.${index}.before_comments`)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Observations before treatment..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        After Comments
                      </label>
                      <textarea
                        {...register(`applications.${index}.after_comments`)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Observations after treatment..."
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={createApplicationMutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:opacity-50"
                >
                  {createApplicationMutation.isPending ? 'Saving...' : 'Next'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            </form>
          )}

          {currentStep === 3 && (
            <form onSubmit={handleSubmit(onSubmitStep3)} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Step 3: Outcome & Final Comments
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yield Value
                  </label>
                  <input
                    type="number"
                    step="any"
                    {...register('yield_value', { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yield Unit
                  </label>
                  <input
                    type="text"
                    {...register('yield_unit')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., kg, tons"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Final Comments
                </label>
                <textarea
                  {...register('final_comments')}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Overall observations and conclusions..."
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Complete Trial
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
