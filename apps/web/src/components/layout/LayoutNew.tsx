import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebarZenon } from "@/components/app-sidebar-zenon"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { BreadcrumbProvider, useBreadcrumbContext } from "@/contexts/BreadcrumbContext"

/**
 * Reads breadcrumbs from context and renders the top header bar.
 * Separated so it sits inside the BreadcrumbProvider and can
 * subscribe to breadcrumb changes without re-mounting the sidebar.
 */
function LayoutHeader() {
  const { breadcrumbs } = useBreadcrumbContext()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </header>
  )
}

/**
 * Shared application shell.  Rendered once as a React Router layout
 * route so the sidebar persists across page navigations.
 */
export default function LayoutNew() {
  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <AppSidebarZenon />
        <SidebarInset>
          <LayoutHeader />
          <main className="flex flex-1 flex-col gap-4 p-4 overflow-y-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </BreadcrumbProvider>
  )
}
