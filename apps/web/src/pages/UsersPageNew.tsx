import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { userService } from '../services/user.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PermissionGuard } from '../components/PermissionGuard';
import type { User } from '../types';
import type { DataTableColumn } from '@/components/ui/data-table';

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  username: z.string().min(3, 'Username must be at least 3 characters').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'SUBADMIN']),
  permissions: z.array(z.string()).default([]),
});

type UserForm = z.infer<typeof userSchema>;

// Define all available resources and their permissions
const PERMISSION_RESOURCES = [
  { key: 'dashboard', label: 'Dashboard', hasManage: false },
  { key: 'farmers', label: 'Farmers', hasManage: true },
  { key: 'trials', label: 'Trials', hasManage: true },
  { key: 'products', label: 'Products', hasManage: true },
  { key: 'applications', label: 'Applications', hasManage: true },
  { key: 'batches', label: 'Product Batches', hasManage: true },
  { key: 'raw-materials', label: 'Raw Materials', hasManage: true },
  { key: 'bom', label: 'Bill of Materials', hasManage: true },
  { key: 'production', label: 'Production', hasManage: true },
  { key: 'customers', label: 'Customers', hasManage: true },
  { key: 'suppliers', label: 'Suppliers', hasManage: true },
  { key: 'sales-orders', label: 'Sales Orders', hasManage: true },
  { key: 'invoices', label: 'Invoices', hasManage: true },
  { key: 'payments', label: 'Payments', hasManage: true },
  { key: 'purchase-orders', label: 'Purchase Orders', hasManage: true },
  { key: 'raw-material-batches', label: 'RM Batches', hasManage: true },
  { key: 'users', label: 'Users', hasManage: true },
] as const;

// Permission dependencies - define which permissions require other permissions
const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // Trials require farmers and products to be viewed
  'trials:create': ['farmers:view', 'products:view'],
  'trials:update': ['farmers:view', 'products:view'],
  'trials:manage': ['farmers:view', 'products:view', 'applications:manage'],

  // Applications require batches and trials
  'applications:create': ['batches:view', 'trials:view'],
  'applications:update': ['batches:view', 'trials:view'],
  'applications:manage': ['batches:view', 'trials:view'],

  // Batches require products
  'batches:create': ['products:view'],
  'batches:update': ['products:view'],
  'batches:manage': ['products:view'],

  // Production requires products, raw materials, and BOM
  'production:create': ['products:view', 'raw-materials:view', 'bom:view'],
  'production:update': ['products:view', 'raw-materials:view', 'bom:view'],
  'production:manage': ['products:view', 'raw-materials:view', 'bom:view'],

  // BOM requires products and raw materials
  'bom:create': ['products:view', 'raw-materials:view'],
  'bom:update': ['products:view', 'raw-materials:view'],
  'bom:manage': ['products:view', 'raw-materials:view'],

  // Sales orders require customers and products
  'sales-orders:create': ['customers:view', 'products:view'],
  'sales-orders:update': ['customers:view', 'products:view'],
  'sales-orders:manage': ['customers:view', 'products:view'],

  // Invoices require sales orders and customers
  'invoices:create': ['sales-orders:view', 'customers:view'],
  'invoices:update': ['sales-orders:view', 'customers:view'],
  'invoices:manage': ['sales-orders:view', 'customers:view'],

  // Purchase orders require suppliers and raw materials
  'purchase-orders:create': ['suppliers:view', 'raw-materials:view'],
  'purchase-orders:update': ['suppliers:view', 'raw-materials:view'],
  'purchase-orders:manage': ['suppliers:view', 'raw-materials:view'],

  // Raw material batches require raw materials
  'raw-material-batches:create': ['raw-materials:view'],
  'raw-material-batches:update': ['raw-materials:view'],
  'raw-material-batches:manage': ['raw-materials:view'],
};

// Get all permissions for ADMIN role
const getAllPermissions = (): string[] => {
  const permissions: string[] = [];
  PERMISSION_RESOURCES.forEach((resource) => {
    PERMISSION_ACTIONS.forEach(action => {
      if (!resource.hasManage && action.key !== 'view') {
        // Skip CRUD permissions for resources that don't have them
        return;
      }
      permissions.push(`${resource.key}:${action.key}`);
    });
  });
  return permissions;
};

// Get all action permissions for a specific resource
const getAllResourcePermissions = (resourceKey: string): string[] => {
  return PERMISSION_ACTIONS.map(action => `${resourceKey}:${action.key}`);
};

// Permission hierarchy within the same resource
const getActionHierarchy = (permission: string): string[] => {
  const [resource, action] = permission.split(':');
  const implied: string[] = [permission];

  const HIERARCHY: Record<string, string[]> = {
    'manage': ['view', 'create', 'update', 'delete'],
    'create': ['view'],
    'update': ['view'],
    'delete': ['view'],
  };

  const impliedActions = HIERARCHY[action] || [];
  impliedActions.forEach(impliedAction => {
    implied.push(`${resource}:${impliedAction}`);
  });

  return implied;
};

// Available actions for permissions
const PERMISSION_ACTIONS = [
  { key: 'view', label: 'View', description: 'Read-only access' },
  { key: 'create', label: 'Create', description: 'Add new records' },
  { key: 'update', label: 'Edit', description: 'Modify existing records' },
  { key: 'delete', label: 'Delete', description: 'Remove records' },
] as const;

// Get all dependencies for a permission (recursive)
const getPermissionDependencies = (permission: string, visited = new Set<string>()): string[] => {
  if (visited.has(permission)) return [];
  visited.add(permission);

  const dependencies = PERMISSION_DEPENDENCIES[permission] || [];
  const allDeps: string[] = [];

  // Add direct dependencies and their action hierarchies
  dependencies.forEach(dep => {
    const depHierarchy = getActionHierarchy(dep);
    depHierarchy.forEach(p => {
      if (!allDeps.includes(p)) {
        allDeps.push(p);
      }
    });
  });

  // Recursively get dependencies of dependencies
  dependencies.forEach(dep => {
    const subDeps = getPermissionDependencies(dep, visited);
    subDeps.forEach(subDep => {
      if (!allDeps.includes(subDep)) {
        allDeps.push(subDep);
      }
    });
  });

  return allDeps;
};

export default function UsersPageNew() {
  useBreadcrumbs([{ label: 'Users' }]);
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showPassword, setShowPassword] = useState(false);

  const handleSortChange = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  };
  const limit = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, sortBy, sortOrder],
    queryFn: () => userService.getAll({ page, limit, search: search || undefined, sortBy, sortOrder }),
  });

  const form = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'SUBADMIN',
      permissions: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: userService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      setIsModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserForm> }) =>
      userService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      setIsModalOpen(false);
      setEditingId(null);
      form.reset();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: userService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    },
  });

  const handleAdd = () => {
    setEditingId(null);
    setShowPassword(false);
    form.reset({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'SUBADMIN',
      permissions: [],
    });
    setIsModalOpen(true);
  };

  const handleEdit = async (userId: string) => {
    setEditingId(userId);
    setShowPassword(false);

    try {
      // Fetch fresh user data from backend
      const freshUserData = await userService.getById(userId);

      form.reset({
        name: freshUserData.name,
        email: freshUserData.email,
        username: freshUserData.username || '',
        password: '',
        role: freshUserData.role,
        permissions: Array.isArray(freshUserData.permissions) ? freshUserData.permissions : [],
      });
      setIsModalOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to fetch user data');
      setEditingId(null);
    }
  };

  const handleDelete = (userId: string) => {
    setDeletingId(userId);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const onSubmit = (data: UserForm) => {
    // If ADMIN role, give all permissions
    const finalData = {
      ...data,
      permissions: data.role === 'ADMIN' ? getAllPermissions() : data.permissions,
    };

    if (editingId) {
      // Don't send password if it's empty
      if (!finalData.password) {
        delete finalData.password;
      }
      updateMutation.mutate({ id: editingId, data: finalData });
    } else {
      createMutation.mutate(finalData);
    }
  };

  const users = (data as any)?.users || [];
  const selectedRole = form.watch('role');
  const rawPermissions = form.watch('permissions');
  const currentPermissions = Array.isArray(rawPermissions) ? rawPermissions : [];

  // Helper function to check if permission is selected
  const hasPermission = (permission: string) => {
    return currentPermissions.includes(permission);
  };

  // Toggle permission with automatic dependency inclusion
  const togglePermission = (permission: string, checked: boolean) => {
    const current = form.getValues('permissions') || [];

    if (checked) {
      const newPermissions = [...current];

      // Add the permission itself and its action hierarchy (e.g., manage -> view, create, update, delete)
      const hierarchy = getActionHierarchy(permission);
      hierarchy.forEach(p => {
        if (!newPermissions.includes(p)) {
          newPermissions.push(p);
        }
      });

      // Add all cross-resource dependencies
      const dependencies = getPermissionDependencies(permission);
      dependencies.forEach(dep => {
        if (!newPermissions.includes(dep)) {
          newPermissions.push(dep);
        }
      });

      form.setValue('permissions', newPermissions);
    } else {
      // Remove the permission (but keep dependencies if they're needed by other permissions)
      const remaining = current.filter((p) => p !== permission);
      form.setValue('permissions', remaining);
    }
  };

  // Select all permissions for a resource
  const toggleResourceAll = (resource: typeof PERMISSION_RESOURCES[number], checked: boolean) => {
    const resourcePermissions = resource.hasManage
      ? getAllResourcePermissions(resource.key)
      : [`${resource.key}:view`];

    const current = form.getValues('permissions') || [];

    if (checked) {
      // Add all action permissions and their dependencies for this resource
      const newPermissions = [...current];
      resourcePermissions.forEach((perm) => {
        // Add the permission and its hierarchy
        const hierarchy = getActionHierarchy(perm);
        hierarchy.forEach(p => {
          if (!newPermissions.includes(p)) {
            newPermissions.push(p);
          }
        });

        // Add cross-resource dependencies
        const dependencies = getPermissionDependencies(perm);
        dependencies.forEach(dep => {
          if (!newPermissions.includes(dep)) {
            newPermissions.push(dep);
          }
        });
      });
      form.setValue('permissions', newPermissions);
    } else {
      // Remove all permissions for this resource
      form.setValue('permissions', current.filter((p) => !p.startsWith(`${resource.key}:`)));
    }
  };

  // Check if all permissions for a resource are selected
  const isResourceFullySelected = (resource: typeof PERMISSION_RESOURCES[number]) => {
    if (!resource.hasManage) {
      return hasPermission(`${resource.key}:view`);
    }

    // Check if all CRUD permissions are selected
    return PERMISSION_ACTIONS.every(action =>
      hasPermission(`${resource.key}:${action.key}`)
    );
  };

  // Check if a permission is required by any selected permission
  const isRequiredDependency = (permission: string): boolean => {
    const current = form.getValues('permissions') || [];
    return current.some(p => {
      const deps = getPermissionDependencies(p);
      return deps.includes(permission);
    });
  };

  // Get friendly names for dependencies
  const getResourceLabel = (resourceKey: string): string => {
    const resource = PERMISSION_RESOURCES.find(r => r.key === resourceKey);
    return resource?.label || resourceKey;
  };

  // Format dependencies for display
  const formatDependencies = (permission: string): string | null => {
    const deps = PERMISSION_DEPENDENCIES[permission];
    if (!deps || deps.length === 0) return null;

    const formatted = deps.map(dep => {
      const [resource, action] = dep.split(':');
      const actionLabel = action === 'manage' ? ' (Manage)' : action === 'view' ? ' (View)' : '';
      return `${getResourceLabel(resource)}${actionLabel}`;
    });

    return formatted.join(', ');
  };

  const columns: DataTableColumn[] = [
    { header: 'Name', accessor: 'name', sortKey: 'name', cellClassName: 'font-medium' },
    { header: 'Email', accessor: 'email', sortKey: 'email' },
    { header: 'Username', accessor: 'username', sortKey: 'username' },
    {
      header: 'Role',
      accessor: 'role',
      sortKey: 'role',
      cell: (row: any) => (
        <Badge
          variant={row.role === 'ADMIN' ? 'default' : 'secondary'}
          className={row.role === 'ADMIN' ? 'bg-teal-100 text-teal-800' : ''}
        >
          <Shield className="mr-1 h-3 w-3" />
          {row.role}
        </Badge>
      ),
    },
    {
      header: 'Created',
      accessor: 'created_at',
      sortKey: 'created_at',
      cell: (row: any) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const rowActions = [
    { type: 'edit' as const, label: 'Edit', onClick: handleEdit },
    { type: 'delete' as const, label: 'Delete', onClick: handleDelete, destructive: true },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage user accounts and permissions"
        actions={
          <PermissionGuard permission="users:manage">
            <Button onClick={handleAdd} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </PermissionGuard>
        }
      />

      <DataTable
        title="All Users"
        description={`${data?.pagination?.total || 0} total users`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        columns={columns}
        data={users}
        rowId="id"
        rowActions={rowActions}
        pagination={data?.pagination}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No users found"
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name or email..."
        onPrimaryColumnClick={(id) => handleEdit(id)}
      />

      {/* Create/Edit User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit User' : 'Add User'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update user information and permissions' : 'Create a new user account'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
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
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{editingId ? 'New Password (leave blank to keep current)' : 'Password'}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder={editingId ? 'Leave blank to keep current password' : 'Enter password'}
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin (Full Access)</SelectItem>
                        <SelectItem value="SUBADMIN">Sub Admin (Custom Permissions)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'ADMIN'
                        ? 'Admin users have full access to all features'
                        : 'Sub Admin users can be assigned specific permissions'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Permissions - Only show for SUBADMIN */}
              {selectedRole === 'SUBADMIN' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Permissions</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allSelected = PERMISSION_RESOURCES.every((r) => isResourceFullySelected(r));
                          if (allSelected) {
                            form.setValue('permissions', []);
                          } else {
                            form.setValue('permissions', getAllPermissions());
                          }
                        }}
                      >
                        {PERMISSION_RESOURCES.every((r) => isResourceFullySelected(r)) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        <strong>Permission Dependencies:</strong> Some permissions automatically include others.
                      </p>
                      <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                        <li><strong>Individual permissions:</strong> View (read), Create (add), Edit (modify), Delete (remove)</li>
                        <li><strong>All checkbox:</strong> Select all permissions for a resource at once</li>
                        <li><strong>Cross-resource:</strong> Some permissions automatically include others (e.g., Trials → Farmers & Products)</li>
                        <li><strong>Required permissions</strong> shown in <span className="text-blue-600">blue</span> and cannot be unchecked while in use</li>
                      </ul>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4 space-y-4">
                    {PERMISSION_RESOURCES.map((resource) => (
                      <div key={resource.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`all-${resource.key}`}
                              checked={isResourceFullySelected(resource)}
                              onCheckedChange={(checked) =>
                                toggleResourceAll(resource, checked as boolean)
                              }
                            />
                            <Label
                              htmlFor={`all-${resource.key}`}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {resource.label}
                            </Label>
                          </div>
                        </div>
                        <div className="ml-6 space-y-2">
                          {/* Render each permission action */}
                          {PERMISSION_ACTIONS.map((action) => {
                            // Skip CRUD permissions for resources without hasManage
                            if (!resource.hasManage && action.key !== 'view') {
                              return null;
                            }

                            const permission = `${resource.key}:${action.key}`;
                            const isRequired = isRequiredDependency(permission);
                            const deps = formatDependencies(permission);

                            return (
                              <div key={action.key} className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={permission}
                                    checked={hasPermission(permission)}
                                    onCheckedChange={(checked) =>
                                      togglePermission(permission, checked as boolean)
                                    }
                                    disabled={isRequired}
                                  />
                                  <Label
                                    htmlFor={permission}
                                    className={`text-sm cursor-pointer ${isRequired ? 'text-blue-600' : 'text-muted-foreground'}`}
                                  >
                                    {action.label}
                                    {isRequired && (
                                      <span className="text-xs text-blue-500 ml-1">(required)</span>
                                    )}
                                    {!isRequired && (
                                      <span className="text-xs text-gray-400 ml-1">({action.description})</span>
                                    )}
                                  </Label>
                                </div>
                                {deps && (
                                  <p className="text-xs text-amber-600 ml-6">
                                    ⚠️ Requires: {deps}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    form.reset();
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingId
                    ? 'Update User'
                    : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete User"
        message="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        loading={deleteMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
