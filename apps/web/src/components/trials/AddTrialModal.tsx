import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, X } from 'lucide-react';
import PhotoUpload from './PhotoUpload';
import { trialService } from '../../services/trial.service';
import { applicationService } from '../../services/application.service';
import { productService } from '../../services/product.service';
import { farmerService } from '../../services/farmer.service';

const trialSchema = z.object({
  farmer_id: z.string().min(1, 'Farmer is required'),
  product_id: z.string().min(1, 'Product is required'),
  crop: z.string().min(1, 'Crop is required'),
  village: z.string().min(1, 'Village is required'),
  season: z.string().optional(),
  start_date: z.date(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  with_other_products: z.string().optional(),
  applications: z.array(
    z.object({
      app_number: z.number(),
      app_type: z.enum(['DRIP', 'IRRIGATION', 'SPRAY']),
      app_date: z.date(),
      before_comments: z.string().optional(),
      after_comments: z.string().optional(),
    })
  ),
  yield_value: z.number().optional(),
  yield_unit: z.string().optional(),
  final_comments: z.string().optional(),
});

type TrialFormData = z.infer<typeof trialSchema>;

interface AddTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddTrialModal({ isOpen, onClose }: AddTrialModalProps) {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [createdTrialId, setCreatedTrialId] = useState<string | null>(null);
  const [createdApplications, setCreatedApplications] = useState<any[]>([]);

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

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrialFormData>({
    resolver: zodResolver(trialSchema),
    defaultValues: {
      start_date: new Date(),
      applications: [
        {
          app_number: 1,
          app_type: 'SPRAY',
          app_date: new Date(),
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'applications',
  });

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

  const uploadPhotoMutation = useMutation({
    mutationFn: ({
      applicationId,
      file,
      stage,
    }: {
      applicationId: string;
      file: File;
      stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED';
    }) => applicationService.uploadPhoto(applicationId, file, stage),
  });

  const onSubmitStep1 = async (data: TrialFormData) => {
    const trialData = {
      farmer_id: data.farmer_id,
      product_id: data.product_id,
      crop: data.crop,
      village: data.village,
      season: data.season,
      start_date: format(data.start_date, 'yyyy-MM-dd'),
      gps_lat: data.gps_lat,
      gps_lng: data.gps_lng,
      with_other_products: data.with_other_products,
      status: 'DRAFT' as const,
    };
    createTrialMutation.mutate(trialData);
  };

  const onSubmitStep2 = async (data: TrialFormData) => {
    if (!createdTrialId) return;

    try {
      const apps = [];
      for (const app of data.applications) {
        const createdApp = await createApplicationMutation.mutateAsync({
          trial_id: createdTrialId,
          app_number: app.app_number,
          app_type: app.app_type,
          app_date: format(app.app_date, 'yyyy-MM-dd'),
          before_comments: app.before_comments,
          after_comments: app.after_comments,
          status: 'pending',
        });
        apps.push(createdApp);
      }
      setCreatedApplications(apps);
      setCurrentStep(3);
    } catch (error) {
      console.error('Failed to create applications:', error);
    }
  };

  const onSubmitStep3 = async (data: TrialFormData) => {
    if (!createdTrialId) return;

    await trialService.update(createdTrialId, {
      yield_value: data.yield_value,
      yield_unit: data.yield_unit,
      final_comments: data.final_comments,
      status: 'IN_PROGRESS',
    });

    queryClient.invalidateQueries({ queryKey: ['trials'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    handleClose();
  };

  const handleClose = () => {
    reset();
    setCurrentStep(1);
    setCreatedTrialId(null);
    setCreatedApplications([]);
    onClose();
  };

  const handlePhotoUpload = async (
    appIndex: number,
    file: File,
    stage: 'BEFORE_UNTREATED' | 'AFTER_TREATED'
  ) => {
    if (!createdApplications[appIndex]) {
      alert('Please save applications first before uploading photos');
      return;
    }

    await uploadPhotoMutation.mutateAsync({
      applicationId: createdApplications[appIndex].id,
      file,
      stage,
    });
  };

  const handlePhotoDelete = async (photoId: string) => {
    await applicationService.deletePhoto(photoId);
  };

  const productOptions = (products?.data || []).map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const farmerOptions = (farmers?.data || []).map((f: any) => ({
    value: f.id,
    label: `${f.name} - ${f.village}`,
  }));

  const appTypeOptions = [
    { value: 'SPRAY', label: 'Spray' },
    { value: 'DRIP', label: 'Drip' },
    { value: 'IRRIGATION', label: 'Irrigation' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Add New Trial</h2>
              <p className="text-sm text-gray-600 mt-1">
                Create a new crop trial by following the steps below
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X className="h-6 w-6 text-gray-600" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="px-6 py-4 bg-gray-50 border-b">
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
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {step.num}
                    </div>
                    <span
                      className={`ml-2 text-sm font-medium ${
                        currentStep >= step.num ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < 2 && (
                    <div
                      className={`flex-1 h-1 mx-4 ${
                        currentStep > step.num ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 220px)' }}>
            {currentStep === 1 && (
              <form onSubmit={handleSubmit(onSubmitStep1)} className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Step 1: Basic Information</h3>

                {/* Product Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="product_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={productOptions}
                        value={productOptions.find((o) => o.value === field.value)}
                        onChange={(option) => field.onChange(option?.value || '')}
                        placeholder="Select a product"
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                    )}
                  />
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
                    name="farmer_id"
                    control={control}
                    render={({ field }) => (
                      <Select
                        {...field}
                        options={farmerOptions}
                        value={farmerOptions.find((o: any) => o.value === field.value)}
                        onChange={(option: any) => field.onChange(option?.value || '')}
                        placeholder="Select a farmer"
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                  {errors.farmer_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.farmer_id.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Crop <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('crop')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Tomato"
                    />
                    {errors.crop && <p className="text-red-500 text-sm mt-1">{errors.crop.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Village <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...register('village')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Village name"
                    />
                    {errors.village && (
                      <p className="text-red-500 text-sm mt-1">{errors.village.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                    <input
                      type="text"
                      {...register('season')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Kharif 2025"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="start_date"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value}
                          onChange={(date) => field.onChange(date)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          dateFormat="yyyy-MM-dd"
                        />
                      )}
                    />
                    {errors.start_date && (
                      <p className="text-red-500 text-sm mt-1">{errors.start_date.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GPS Latitude</label>
                    <input
                      type="number"
                      step="any"
                      {...register('gps_lat', { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 28.7041"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GPS Longitude</label>
                    <input
                      type="number"
                      step="any"
                      {...register('gps_lng', { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 77.1025"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Used with Other Products
                  </label>
                  <input
                    type="text"
                    {...register('with_other_products')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Product X, Product Y"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={createTrialMutation.isPending}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center disabled:opacity-50"
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
                  <h3 className="text-xl font-semibold text-gray-900">Step 2: Applications & Photos</h3>
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        app_number: fields.length + 1,
                        app_type: 'SPRAY',
                        app_date: new Date(),
                      })
                    }
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Application
                  </button>
                </div>

                {fields.map((field, index) => (
                  <div key={field.id} className="border border-gray-200 rounded-lg p-6 space-y-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-medium text-gray-900">Application #{index + 1}</h4>
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
                        <Controller
                          name={`applications.${index}.app_type`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              {...field}
                              options={appTypeOptions}
                              value={appTypeOptions.find((o) => o.value === field.value)}
                              onChange={(option) => field.onChange(option?.value)}
                              className="react-select-container"
                              classNamePrefix="react-select"
                            />
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Application Date <span className="text-red-500">*</span>
                        </label>
                        <Controller
                          name={`applications.${index}.app_date`}
                          control={control}
                          render={({ field }) => (
                            <DatePicker
                              selected={field.value}
                              onChange={(date) => field.onChange(date)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              dateFormat="yyyy-MM-dd"
                            />
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Before Comments
                        </label>
                        <textarea
                          {...register(`applications.${index}.before_comments`)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          placeholder="Observations after treatment..."
                        />
                      </div>
                    </div>

                    {createdApplications[index] && (
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <PhotoUpload
                          stage="BEFORE_UNTREATED"
                          photos={createdApplications[index].photos || []}
                          onUpload={(file, stage) => handlePhotoUpload(index, file, stage)}
                          onDelete={handlePhotoDelete}
                          label="Before (Untreated) Photos"
                        />

                        <PhotoUpload
                          stage="AFTER_TREATED"
                          photos={createdApplications[index].photos || []}
                          onUpload={(file, stage) => handlePhotoUpload(index, file, stage)}
                          onDelete={handlePhotoDelete}
                          label="After (Treated) Photos"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex justify-between pt-4">
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
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center disabled:opacity-50"
                  >
                    {createApplicationMutation.isPending ? 'Saving...' : 'Next'}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </form>
            )}

            {currentStep === 3 && (
              <form onSubmit={handleSubmit(onSubmitStep3)} className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Step 3: Outcome & Final Comments
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yield Value</label>
                    <input
                      type="number"
                      step="any"
                      {...register('yield_value', { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 1500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yield Unit</label>
                    <input
                      type="text"
                      {...register('yield_unit')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., kg, tons"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Final Comments</label>
                  <textarea
                    {...register('final_comments')}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Overall observations and conclusions..."
                  />
                </div>

                <div className="flex justify-between pt-4">
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
      </div>
    </div>
  );
}
