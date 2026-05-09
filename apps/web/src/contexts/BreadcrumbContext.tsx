import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Breadcrumb = { label: string; href?: string };

type BreadcrumbContextType = {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
};

const BreadcrumbContext = createContext<BreadcrumbContextType>({
  breadcrumbs: [],
  setBreadcrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  return (
    <BreadcrumbContext.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook for pages to declare their breadcrumbs.
 * Call once at the top of a page component:
 *   useBreadcrumbs([{ label: 'Dashboard' }])
 */
export function useBreadcrumbs(breadcrumbs: Breadcrumb[]) {
  const { setBreadcrumbs } = useContext(BreadcrumbContext);
  // Serialise so the effect dep is stable across renders
  const serialized = JSON.stringify(breadcrumbs);
  useEffect(() => {
    setBreadcrumbs(JSON.parse(serialized));
    return () => setBreadcrumbs([]);
  }, [serialized, setBreadcrumbs]);
}

export function useBreadcrumbContext() {
  return useContext(BreadcrumbContext);
}
