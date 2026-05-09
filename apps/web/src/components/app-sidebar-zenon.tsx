import * as React from "react"
import {
  LayoutDashboardIcon,
  UsersIcon,
  PackageIcon,
  SproutIcon,
  PackageCheckIcon,
  FlaskConicalIcon,
  UserCog,
  SettingsIcon,
  BoxIcon,
  WarehouseIcon,
  ListChecksIcon,
  FactoryIcon,
  Building2Icon,
  TruckIcon,
  ShoppingCartIcon,
  ShoppingBagIcon,
  FileTextIcon,
  WalletIcon,
  PackageOpenIcon,
  TrendingUpIcon,
} from "lucide-react"

import { NavMainZenon } from "@/components/nav-main-zenon"
import { NavUserZenon } from "@/components/nav-user-zenon"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/contexts/AuthContext"
import { usePermissions } from "@/hooks/usePermissions"

export function AppSidebarZenon({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { hasPermission, canView } = usePermissions()

  const isAdmin = user?.role === 'ADMIN'

  // Build navigation groups based on permissions
  const navGroups = []

  // Dashboard - shown if user has dashboard:view permission
  if (hasPermission('dashboard:view')) {
    navGroups.push({
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: LayoutDashboardIcon,
        },
      ],
    })
  }

  // Trial Management - shown if user has trials:view or farmers:view
  const trialManagementItems = []
  if (canView('trials')) {
    trialManagementItems.push({
      title: "Trials",
      url: "/trials",
      icon: FlaskConicalIcon,
    })
  }
  if (canView('farmers')) {
    trialManagementItems.push({
      title: "Farmers",
      url: "/farmers",
      icon: UsersIcon,
    })
  }
  if (trialManagementItems.length > 0) {
    navGroups.push({
      label: "Trial Management",
      items: trialManagementItems,
    })
  }

  // Inventory & Production - shown if user has relevant permissions
  const inventoryItems = []
  if (canView('products') || canView('raw-materials') || canView('production')) {
    inventoryItems.push({
      title: "Overview",
      url: "/inventory-overview",
      icon: WarehouseIcon,
    })
  }
  if (canView('products')) {
    inventoryItems.push({
      title: "Products",
      url: "/products",
      icon: PackageIcon,
    })
  }
  if (canView('raw-materials')) {
    inventoryItems.push({
      title: "Raw Materials",
      url: "/raw-materials",
      icon: BoxIcon,
    })
  }
  if (canView('bom')) {
    inventoryItems.push({
      title: "Product Recipes",
      url: "/bom",
      icon: ListChecksIcon,
    })
  }
  if (canView('production')) {
    inventoryItems.push({
      title: "Production",
      url: "/production",
      icon: FactoryIcon,
    })
  }
  if (inventoryItems.length > 0) {
    navGroups.push({
      label: "Inventory & Production",
      items: inventoryItems,
    })
  }

  // Sales & Customers - shown if user has relevant permissions
  const salesItems = []
  if (canView('customers') || canView('sales-orders') || canView('invoices') || canView('payments')) {
    salesItems.push({
      title: "Overview",
      url: "/sales-overview",
      icon: TrendingUpIcon,
    })
  }
  if (canView('customers')) {
    salesItems.push({
      title: "Customers",
      url: "/customers",
      icon: Building2Icon,
    })
  }
  if (canView('sales-orders')) {
    salesItems.push({
      title: "Sales Orders",
      url: "/sales-orders",
      icon: ShoppingBagIcon,
    })
  }
  if (canView('invoices')) {
    salesItems.push({
      title: "Invoices",
      url: "/invoices",
      icon: FileTextIcon,
    })
  }
  if (canView('payments')) {
    salesItems.push({
      title: "Payments",
      url: "/payments",
      icon: WalletIcon,
    })
  }
  if (salesItems.length > 0) {
    navGroups.push({
      label: "Sales & Customers",
      items: salesItems,
    })
  }

  // Purchasing - shown if user has relevant permissions
  const purchasingItems = []
  if (canView('suppliers')) {
    purchasingItems.push({
      title: "Suppliers",
      url: "/suppliers",
      icon: TruckIcon,
    })
  }
  if (canView('purchase-orders')) {
    purchasingItems.push({
      title: "Purchase Orders",
      url: "/purchase-orders",
      icon: ShoppingCartIcon,
    })
  }
  if (hasPermission('raw-material-batches:view')) {
    purchasingItems.push({
      title: "RM Batches",
      url: "/rm-batches",
      icon: PackageOpenIcon,
    })
  }
  if (purchasingItems.length > 0) {
    navGroups.push({
      label: "Purchasing",
      items: purchasingItems,
    })
  }

  // Administration - shown if user has users:view or company-settings:view permission
  const adminItems = []
  if (canView('users')) {
    adminItems.push({
      title: "Users",
      url: "/users",
      icon: UserCog,
    })
  }
  if (canView('company-settings')) {
    adminItems.push({
      title: "Company Settings",
      url: "/settings",
      icon: SettingsIcon,
    })
  }
  if (adminItems.length > 0) {
    navGroups.push({
      label: "Administration",
      items: adminItems,
    })
  }

  const userData = {
    name: user?.name || "User",
    email: user?.email || "user@example.com",
    avatar: "/avatars/default.jpg",
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
              <a href="/" className="flex items-center justify-center w-full">
                <span className="text-3xl font-black text-[#0e696e] leading-none group-data-[collapsible=icon]:block hidden">Z</span>
                <div className="flex flex-col items-center group-data-[collapsible=icon]:hidden w-full">
                  <span className="text-3xl font-black tracking-wider text-[#0e696e] leading-none">ZENÖN</span>
                  <span className="text-xs font-semibold tracking-widest text-[#0e696e] leading-none mt-1">BIO SCIENCE</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMainZenon groups={navGroups} />
      </SidebarContent>
      <SidebarFooter>
        <NavUserZenon user={userData} />
      </SidebarFooter>
    </Sidebar>
  )
}
