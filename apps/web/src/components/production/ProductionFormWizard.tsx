import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ChevronRight, ChevronLeft, Package, Calendar, AlertCircle } from 'lucide-react';
import { productService } from '../../services/product.service';
import { bomService } from '../../services/bom.service';
import { rmBatchService } from '../../services/rm-batch.service';
import { productionService } from '../../services/production.service';
import { FormModal } from '@/components/ui/form-modal';
import { Button } from '@/components/ui/button';
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
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

const UNITS = ['KG', 'LITER', 'PIECE'];

const productionSchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  batch_number: z.string().min(1, 'Batch number is required'),
  manufacturing_date: z.date().refine((date) => date <= new Date(), {
    message: 'Manufacturing date cannot be in the future',
  }),
  expiry_date: z.date(),
  quantity_produced: z.coerce.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  storage_location: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => data.expiry_date > data.manufacturing_date, {
  message: 'Expiry date must be after manufacturing date',
  path: ['expiry_date'],
});

type ProductionForm = z.infer<typeof productionSchema>;

interface RMRequirement {
  raw_material_id: string;
  raw_material_name: string;
  quantity_required: number;
  unit: string;
  available_batches: any[];
  total_available: number;
  selected_batches: { batch_id: string; quantity: number }[];
}

interface ProductionFormWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { number: 1, label: 'Product Details' },
  { number: 2, label: 'RM Batch Selection' },
  { number: 3, label: 'Review & Confirm' },
];

export default function ProductionFormWizard({ isOpen, onClose, onSuccess }: ProductionFormWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [rmRequirements, setRmRequirements] = useState<RMRequirement[]>([]);
  const [canProceed, setCanProceed] = useState(false);

  const form = useForm<ProductionForm>({
    resolver: zodResolver(productionSchema),
    defaultValues: {
      product_id: '',
      batch_number: '',
      manufacturing_date: new Date(),
      expiry_date: new Date(),
      quantity_produced: 0,
      unit: 'LITER',
      storage_location: '',
      notes: '',
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productService.getAll({ page: 1, limit: 1000 }),
  });

  const products = productsData?.products || [];

  const selectedProductId = form.watch('product_id');
  const quantityToProduce = form.watch('quantity_produced');

  // Auto-generate batch number when product is selected
  useEffect(() => {
    if (selectedProductId && !form.getValues('batch_number')) {
      const selectedProduct = products.find((p: any) => p.id === selectedProductId);
      if (selectedProduct) {
        const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
        const batchNumber = `${selectedProduct.name.substring(0, 3).toUpperCase()}-${timestamp}`;
        form.setValue('batch_number', batchNumber);
      }
    }
  }, [selectedProductId, products]);

  // Fetch BOM for selected product
  const { data: bomData, isLoading: bomLoading } = useQuery({
    queryKey: ['bom', selectedProductId],
    queryFn: () => bomService.getByProduct(selectedProductId),
    enabled: !!selectedProductId && currentStep >= 2,
  });

  // Calculate RM requirements when product or quantity changes
  useEffect(() => {
    if (bomData && quantityToProduce > 0) {
      calculateRMRequirements();
    }
  }, [bomData, quantityToProduce]);

  const calculateRMRequirements = async () => {
    if (!bomData || !bomData.bom_items || quantityToProduce <= 0) {
      setRmRequirements([]);
      setCanProceed(false);
      return;
    }

    const requirements: RMRequirement[] = [];

    for (const bomItem of bomData.bom_items) {
      const quantityRequired = bomItem.quantity_per_unit * quantityToProduce;

      // Fetch available batches for this raw material
      try {
        const response = await rmBatchService.getAll({
          raw_material_id: bomItem.raw_material_id,
          page: 1,
          limit: 100,
        });

        const availableBatches = response.rm_batches
          .filter((batch) => batch.quantity_remaining > 0 && batch.is_active)
          .sort((a, b) => new Date(a.receipt_date).getTime() - new Date(b.receipt_date).getTime()); // FIFO

        const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity_remaining, 0);

        requirements.push({
          raw_material_id: bomItem.raw_material_id,
          raw_material_name: bomItem.raw_material?.name || 'Unknown',
          quantity_required: quantityRequired,
          unit: bomItem.unit,
          available_batches: availableBatches,
          total_available: totalAvailable,
          selected_batches: [],
        });
      } catch (error) {
        toast.error(`Failed to fetch batches for ${bomItem.raw_material?.name}`);
      }
    }

    setRmRequirements(requirements);

    // Auto-select batches using FIFO
    const updatedRequirements = requirements.map((req) => {
      let remainingQty = req.quantity_required;
      const selectedBatches: { batch_id: string; quantity: number }[] = [];

      for (const batch of req.available_batches) {
        if (remainingQty <= 0) break;

        const allocatedQty = Math.min(batch.quantity_remaining, remainingQty);
        selectedBatches.push({
          batch_id: batch.id,
          quantity: allocatedQty,
        });
        remainingQty -= allocatedQty;
      }

      return {
        ...req,
        selected_batches: selectedBatches,
      };
    });

    setRmRequirements(updatedRequirements);

    // Check if all requirements can be fulfilled
    const allFulfilled = updatedRequirements.every((req) => req.total_available >= req.quantity_required);
    setCanProceed(allFulfilled);
  };

  const createMutation = useMutation({
    mutationFn: productionService.createBatchWithConsumption,
    onSuccess: () => {
      toast.success('Production batch created successfully! Raw materials automatically consumed based on recipe.');
      onSuccess();
      handleClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create production batch');
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setRmRequirements([]);
    setCanProceed(false);
    form.reset();
    onClose();
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(['product_id', 'batch_number', 'manufacturing_date', 'expiry_date', 'quantity_produced', 'unit']);
      if (!isValid) return;

      if (!selectedProductId) {
        toast.error('Please select a product');
        return;
      }

      // Check if product has BOM
      if (bomData && bomData.bom_items.length === 0) {
        toast.error('Selected product does not have a recipe (BOM). Please create a recipe first.');
        return;
      }

      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!canProceed) {
        toast.error('Insufficient raw material stock. Please check availability.');
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = (data: ProductionForm) => {
    const submitData = {
      ...data,
      manufacturing_date: format(data.manufacturing_date, 'yyyy-MM-dd'),
      expiry_date: format(data.expiry_date, 'yyyy-MM-dd'),
    };

    createMutation.mutate(submitData);
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Production Batch"
      description="Record finished product production and raw material consumption"
      maxWidth="4xl"
      steps={STEPS}
      currentStep={currentStep}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Step 1: Product Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Finished Product Details</h3>

              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <SearchableCombobox
                      options={products.map((p: any) => ({ value: p.id, label: p.name }))}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select product..."
                      icon={Package}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="batch_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Number (Auto-generated)</FormLabel>
                      <FormControl>
                        <Input placeholder="PROD-BATCH-001" {...field} readOnly className="bg-muted" />
                      </FormControl>
                      <FormDescription>Automatically generated based on product and timestamp</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity_produced"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity to Produce</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="manufacturing_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Manufacturing Date</FormLabel>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select date"
                        icon={Calendar}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiry_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Expiry Date</FormLabel>
                      <DatePickerField
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select date"
                        icon={Calendar}
                        minDate={form.watch('manufacturing_date')}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="storage_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Warehouse 1, Section A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Production notes..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 2: RM Batch Selection */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Raw Material Requirements</h3>

              {bomLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading recipe...
                </div>
              ) : rmRequirements.length === 0 ? (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    No raw material requirements found. Please ensure the selected product has a recipe (BOM) defined.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert className="border-blue-200 bg-blue-50">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Automatic RM Batch Selection:</strong> The system has automatically selected raw material batches using FIFO (First In, First Out) method. You can review the allocations below.
                    </AlertDescription>
                  </Alert>

                  <Accordion type="multiple" className="w-full" defaultValue={rmRequirements.map((_, i) => `item-${i}`)}>
                    {rmRequirements.map((req, index) => (
                      <AccordionItem key={req.raw_material_id} value={`item-${index}`}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{req.raw_material_name}</span>
                              <Badge variant="outline">
                                Required: {req.quantity_required} {req.unit}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={req.total_available >= req.quantity_required ? 'default' : 'destructive'}>
                                Available: {req.total_available.toFixed(2)} {req.unit}
                              </Badge>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-2">
                            {req.total_available < req.quantity_required && (
                              <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>
                                  Insufficient stock! Need {(req.quantity_required - req.total_available).toFixed(2)} {req.unit} more.
                                </AlertDescription>
                              </Alert>
                            )}

                            <div className="text-sm font-medium mb-2">Selected Batches (FIFO):</div>
                            {req.selected_batches.map((sel) => {
                              const batch = req.available_batches.find((b) => b.id === sel.batch_id);
                              return (
                                <div key={sel.batch_id} className="bg-muted p-3 rounded-md text-sm">
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <span className="font-medium">{batch?.batch_number}</span>
                                      <span className="text-muted-foreground ml-2">
                                        (Stock: {batch?.quantity_remaining} {batch?.unit})
                                      </span>
                                    </div>
                                    <Badge>
                                      Allocate: {sel.quantity.toFixed(2)} {req.unit}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Received: {batch?.receipt_date ? format(new Date(batch.receipt_date), 'MMM dd, yyyy') : '-'}
                                  </div>
                                </div>
                              );
                            })}

                            {req.selected_batches.length === 0 && (
                              <div className="text-sm text-muted-foreground italic">
                                No batches available
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {!canProceed && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Cannot proceed with production. Some raw materials have insufficient stock. Please purchase or receive more raw materials before creating this production batch.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Review Production Details</h3>

              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Product</div>
                    <div className="font-medium">{products.find((p: any) => p.id === form.watch('product_id'))?.name}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Batch Number</div>
                    <div className="font-medium">{form.watch('batch_number')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Quantity to Produce</div>
                    <div className="font-medium">{form.watch('quantity_produced')} {form.watch('unit')}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Manufacturing Date</div>
                    <div className="font-medium">{format(form.watch('manufacturing_date'), 'MMM dd, yyyy')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Expiry Date</div>
                    <div className="font-medium">{format(form.watch('expiry_date'), 'MMM dd, yyyy')}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Storage Location</div>
                    <div className="font-medium">{form.watch('storage_location') || '-'}</div>
                  </div>
                </div>

                {form.watch('notes') && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Notes</div>
                    <div className="font-medium">{form.watch('notes')}</div>
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Raw Material Consumption Summary:</div>
                <div className="space-y-2">
                  {rmRequirements.map((req) => (
                    <div key={req.raw_material_id} className="bg-muted p-3 rounded-md">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{req.raw_material_name}</span>
                        <Badge>
                          {req.quantity_required} {req.unit}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        From {req.selected_batches.length} batch{req.selected_batches.length !== 1 ? 'es' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Alert className="border-green-200 bg-green-50">
                <AlertCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Ready to create production batch!</strong> Clicking "Create Production Batch" will:
                  <ul className="list-disc list-inside mt-2">
                    <li>Create a new finished product batch</li>
                    <li>Automatically consume raw materials based on the recipe</li>
                    <li>Update raw material batch stock quantities</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep === 1 ? handleClose : handleBack}
            >
              {currentStep === 1 ? (
                'Cancel'
              ) : (
                <>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </>
              )}
            </Button>

            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createMutation.isPending || !canProceed}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Production Batch'}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </FormModal>
  );
}
