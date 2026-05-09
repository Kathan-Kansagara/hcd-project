import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, X, Check, ChevronsUpDown, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { farmerService } from '../../services/farmer.service';
import { productService } from '../../services/product.service';
import { trialService } from '../../services/trial.service';

export interface TrialFilterValues {
  farmer_id?: string;
  product_id?: string;
  crop?: string;
  village?: string;
  season?: string;
  start_date_from?: string;
  start_date_to?: string;
  status?: string;
  show_archived?: string;
}

interface TrialFiltersProps {
  onFilterChange: (filters: TrialFilterValues) => void;
  initialFilters?: TrialFilterValues;
}

export default function TrialFilters({ onFilterChange, initialFilters = {} }: TrialFiltersProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<TrialFilterValues>(initialFilters);

  // State for combobox open states
  const [cropOpen, setCropOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [villageOpen, setVillageOpen] = useState(false);
  const [farmerOpen, setFarmerOpen] = useState(false);

  const { data: farmersData } = useQuery({
    queryKey: ['farmers', 'all'],
    queryFn: () => farmerService.getAll({ limit: 1000 }),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => productService.getAll({ limit: 1000 }),
  });

  const { data: filterOptions } = useQuery({
    queryKey: ['trial-filter-options'],
    queryFn: () => trialService.getFilterOptions(),
  });

  const farmers = farmersData?.farmers || [];
  const products = productsData?.products || [];
  const crops = filterOptions?.crops || [];
  const seasons = filterOptions?.seasons || [];
  const villages = filterOptions?.villages || [];

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const handleFilterChange = (key: keyof TrialFilterValues, value: string) => {
    const newFilters = {
      ...filters,
      [key]: value === 'all' || value === '' ? undefined : value,
    };
    setFilters(newFilters);
  };

  const handleApply = () => {
    // Remove empty values
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== '' && value !== undefined)
    );
    onFilterChange(cleanFilters);
  };

  const handleClear = () => {
    setFilters({});
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) => filters[key as keyof TrialFilterValues]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant={isOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-primary-foreground text-primary px-2 py-0.5 text-xs">
              {Object.keys(filters).length}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Product Filter */}
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={filters.product_id || 'all'}
                  onValueChange={(value) => handleFilterChange('product_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All products</SelectItem>
                    {products.map((product: any) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Farmer Filter */}
              <div className="space-y-2">
                <Label>Farmer</Label>
                <Popover open={farmerOpen} onOpenChange={setFarmerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={farmerOpen}
                      className="w-full justify-between"
                    >
                      {filters.farmer_id
                        ? farmers.find((farmer: any) => farmer.id === filters.farmer_id)?.name
                        : "Select farmer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Search farmer..." />
                      <CommandList>
                        <CommandEmpty>No farmer found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              handleFilterChange('farmer_id', '');
                              setFarmerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !filters.farmer_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All farmers
                          </CommandItem>
                          {farmers.map((farmer: any) => (
                            <CommandItem
                              key={farmer.id}
                              value={farmer.name}
                              onSelect={() => {
                                handleFilterChange('farmer_id', farmer.id);
                                setFarmerOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.farmer_id === farmer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {farmer.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Crop Filter */}
              <div className="space-y-2">
                <Label>Crop</Label>
                <Popover open={cropOpen} onOpenChange={setCropOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={cropOpen}
                      className="w-full justify-between"
                    >
                      {filters.crop
                        ? crops.find((crop) => crop === filters.crop)
                        : "Select crop..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Search crop..." />
                      <CommandList>
                        <CommandEmpty>No crop found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              handleFilterChange('crop', '');
                              setCropOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !filters.crop ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All crops
                          </CommandItem>
                          {crops.map((crop) => (
                            <CommandItem
                              key={crop}
                              value={crop}
                              onSelect={(currentValue) => {
                                handleFilterChange('crop', currentValue);
                                setCropOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.crop === crop ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {crop}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Village Filter */}
              <div className="space-y-2">
                <Label>Village</Label>
                <Popover open={villageOpen} onOpenChange={setVillageOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={villageOpen}
                      className="w-full justify-between"
                    >
                      {filters.village
                        ? villages.find((village) => village === filters.village)
                        : "Select village..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Search village..." />
                      <CommandList>
                        <CommandEmpty>No village found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              handleFilterChange('village', '');
                              setVillageOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !filters.village ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All villages
                          </CommandItem>
                          {villages.map((village) => (
                            <CommandItem
                              key={village}
                              value={village}
                              onSelect={(currentValue) => {
                                handleFilterChange('village', currentValue);
                                setVillageOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.village === village ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {village}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Season Filter */}
              <div className="space-y-2">
                <Label>Season</Label>
                <Popover open={seasonOpen} onOpenChange={setSeasonOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={seasonOpen}
                      className="w-full justify-between"
                    >
                      {filters.season
                        ? seasons.find((season) => season === filters.season)
                        : "Select season..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder="Search season..." />
                      <CommandList>
                        <CommandEmpty>No season found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              handleFilterChange('season', '');
                              setSeasonOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !filters.season ? "opacity-100" : "opacity-0"
                              )}
                            />
                            All seasons
                          </CommandItem>
                          {seasons.map((season) => (
                            <CommandItem
                              key={season}
                              value={season}
                              onSelect={(currentValue) => {
                                handleFilterChange('season', currentValue);
                                setSeasonOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  filters.season === season ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {season}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Archived Filter - Only for ADMIN */}
              {user?.role === 'ADMIN' && (
                <div className="space-y-2">
                  <Label>View Archived</Label>
                  <Select
                    value={filters.show_archived || 'false'}
                    onValueChange={(value) => handleFilterChange('show_archived', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Hide archived" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Hide archived</SelectItem>
                      <SelectItem value="true">Show archived only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Start Date From */}
              <div className="space-y-2">
                <Label>Start Date From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.start_date_from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.start_date_from ? (
                        format(new Date(filters.start_date_from), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.start_date_from ? new Date(filters.start_date_from) : undefined}
                      onSelect={(date) => {
                        handleFilterChange('start_date_from', date ? format(date, 'yyyy-MM-dd') : '');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Start Date To */}
              <div className="space-y-2">
                <Label>Start Date To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.start_date_to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.start_date_to ? (
                        format(new Date(filters.start_date_to), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.start_date_to ? new Date(filters.start_date_to) : undefined}
                      onSelect={(date) => {
                        handleFilterChange('start_date_to', date ? format(date, 'yyyy-MM-dd') : '');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={handleClear}>
                Clear All
              </Button>
              <Button onClick={handleApply}>Apply Filters</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
