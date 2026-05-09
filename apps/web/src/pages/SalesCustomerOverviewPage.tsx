import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, subDays, subMonths, subYears, startOfDay } from 'date-fns';
import {
  IndianRupee,
  Wallet,
  AlertCircle,
  TrendingUp,
  ShoppingBag,
  Building2,
  BarChart3,
  Clock,
  ArrowRight,
  ExternalLink,
  CalendarIcon,
  ShoppingCart,
  CreditCard,
  FileText,
  Trophy,
  ShieldAlert,
  AlertTriangle,
  CircleAlert,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  ComposedChart,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Area,
} from 'recharts';

import { analyticsService } from '@/services/analytics.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

/* ──────────────── shared chart config ──────────────── */

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
  padding: '8px 12px',
};

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

/* ──────────────── currency formatter ──────────────── */

function formatINR(value: number, compact = false): string {
  if (compact) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/* ──────────────── custom tooltips ──────────────── */

function RevenueCollectionsTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.month}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e' }} />
          Revenue: <strong>{formatINR(d.revenue)}</strong>
        </p>
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#10b981' }} />
          Collections: <strong>{formatINR(d.collections)}</strong>
        </p>
        <p className="text-muted-foreground pt-0.5">
          Gap: {formatINR(d.revenue - d.collections)}
        </p>
      </div>
    </div>
  );
}

function CashFlowTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.month}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#10b981' }} />
          Cash In: <strong>{formatINR(d.cash_in)}</strong>
        </p>
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#ef4444' }} />
          Cash Out: <strong>{formatINR(d.cash_out)}</strong>
        </p>
        <p className={`pt-0.5 font-medium ${d.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          Net: {d.net >= 0 ? '+' : ''}{formatINR(d.net)}
        </p>
      </div>
    </div>
  );
}

function SalesOrderTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.month}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e33' }} />
          Orders: <strong>{d.order_count}</strong>
        </p>
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e' }} />
          Value: <strong>{formatINR(d.order_value)}</strong>
        </p>
      </div>
    </div>
  );
}

function PaymentMethodTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.method.replace(/_/g, ' ')}</p>
      <div className="space-y-0.5 text-xs">
        <p>Count: <strong>{d.count}</strong></p>
        <p>Amount: <strong>{formatINR(d.total_amount)}</strong></p>
      </div>
    </div>
  );
}

function TopPerformerTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.customer_name}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e' }} />
          Revenue: <strong>{formatINR(d.total_revenue)}</strong>
        </p>
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#10b981' }} />
          Collected: <strong>{formatINR(d.total_collected)}</strong>
        </p>
        <p className="text-muted-foreground pt-0.5">
          {d.invoice_count} invoice{d.invoice_count !== 1 ? 's' : ''} &middot; {d.collection_rate}% collected
        </p>
      </div>
    </div>
  );
}

/* ──────────────── performer bar colors ──────────────── */

const PERFORMER_COLORS = ['#0e696e', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'];

/* ──────────────── risk level config ──────────────── */

const RISK_CONFIG = {
  critical: { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900', badge: 'destructive' as const, icon: ShieldAlert },
  high: { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-900', badge: 'default' as const, icon: AlertTriangle },
  medium: { color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-900', badge: 'secondary' as const, icon: CircleAlert },
  low: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900', badge: 'outline' as const, icon: Info },
};

/* ──────────────── stat card ──────────────── */

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  link,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: string;
  link?: string;
  variant?: 'default' | 'warning' | 'danger';
}) {
  const iconColor = variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-orange-500' : 'text-primary';
  const valueColor = variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-orange-600' : '';

  const content = (
    <Card className={link ? 'cursor-pointer transition-colors hover:bg-accent' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        <p className="text-xs text-muted-foreground">
          {subtitle}
          {trend && <span className="ml-1 text-green-600">{trend}</span>}
        </p>
      </CardContent>
    </Card>
  );
  return link ? <Link to={link} className="block">{content}</Link> : content;
}

/* ──────────────── date range helpers ──────────────── */

const PERIOD_PRESETS = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 6 months', value: '6m' },
  { label: 'Last 1 year', value: '1y' },
  { label: 'All time', value: 'all' },
  { label: 'Custom', value: 'custom' },
];

function getDateRange(preset: string): { from: Date; to: Date } {
  const to = new Date();
  switch (preset) {
    case '7d': return { from: subDays(to, 7), to };
    case '30d': return { from: subDays(to, 30), to };
    case '90d': return { from: subDays(to, 90), to };
    case '6m': return { from: subMonths(to, 6), to };
    case '1y': return { from: subYears(to, 1), to };
    case 'all': return { from: new Date('2020-01-01'), to };
    default: return { from: subDays(to, 90), to };
  }
}

/* ──────────────── invoice status colors ──────────────── */

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8',
  SENT: '#3b82f6',
  PARTIALLY_PAID: '#f59e0b',
  PAID: '#10b981',
  OVERDUE: '#ef4444',
  CANCELLED: '#6b7280',
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  BANK_TRANSFER: '#0e696e',
  UPI: '#10b981',
  CASH: '#f59e0b',
  CHEQUE: '#3b82f6',
  CREDIT_CARD: '#8b5cf6',
  OTHER: '#94a3b8',
};

/* ═══════════════════ PAGE ═══════════════════ */

export default function SalesCustomerOverviewPage() {
  useBreadcrumbs([{ label: 'Sales & Customer Overview' }]);

  const [periodPreset, setPeriodPreset] = useState('90d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const dateRange = useMemo(() => {
    if (periodPreset === 'custom' && customFrom && customTo) {
      return { from: startOfDay(customFrom), to: customTo };
    }
    return getDateRange(periodPreset);
  }, [periodPreset, customFrom, customTo]);

  const fromISO = dateRange.from.toISOString().split('T')[0];
  const toISO = dateRange.to.toISOString().split('T')[0];

  const { data, isLoading } = useQuery({
    queryKey: ['sales-customer-overview', fromISO, toISO],
    queryFn: () => analyticsService.getSalesCustomerOverview(fromISO, toISO),
  });

  const summary = data?.summary;
  const charts = data?.charts;
  const tables = data?.tables;

  /* ── aging buckets for overdue invoices ── */
  const agingBuckets = useMemo(() => {
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    (tables?.overdue_invoices || []).forEach((inv) => {
      if (inv.days_overdue <= 30) buckets['0-30']++;
      else if (inv.days_overdue <= 60) buckets['31-60']++;
      else if (inv.days_overdue <= 90) buckets['61-90']++;
      else buckets['90+']++;
    });
    return buckets;
  }, [tables?.overdue_invoices]);

  /* ── loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sales & Customer Overview</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete overview of your sales, revenue, and customer performance</p>
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16 mb-1" /><Skeleton className="h-3 w-20" /></CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header + Date Range Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sales & Customer Overview</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Complete overview of your sales, revenue, and customer performance
            {periodPreset !== 'all' && (
              <span className="ml-1 text-foreground/60">
                &middot; {format(dateRange.from, 'MMM dd, yyyy')} – {format(dateRange.to, 'MMM dd, yyyy')}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Date Range Presets */}
          <Select value={periodPreset} onValueChange={setPeriodPreset}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <CalendarIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom Range Picker */}
          {periodPreset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:min-w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customFrom && customTo
                    ? `${format(customFrom, 'MMM dd')} – ${format(customTo, 'MMM dd, yyyy')}`
                    : 'Pick date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex gap-2 p-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">From</p>
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">To</p>
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          {/* Quick Actions */}
          <Button variant="outline" asChild>
            <Link to="/sales-orders"><ShoppingBag className="mr-2 h-4 w-4" />New Order</Link>
          </Button>
          <Button asChild>
            <Link to="/payments"><Wallet className="mr-2 h-4 w-4" />Record Payment</Link>
          </Button>
        </div>
      </div>

      {/* ═══════════════════ KPI SUMMARY CARDS ═══════════════════ */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Revenue & Collections</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={formatINR(summary?.total_revenue || 0)}
            subtitle="Invoiced amount in period"
            icon={IndianRupee}
            link="/invoices"
          />
          <StatCard
            title="Total Collected"
            value={formatINR(summary?.total_collected || 0)}
            subtitle="Payments received"
            icon={Wallet}
            link="/payments"
          />
          <StatCard
            title="Outstanding"
            value={formatINR(summary?.total_outstanding || 0)}
            subtitle="Pending collection"
            icon={AlertCircle}
            variant={(summary?.total_outstanding || 0) > 0 ? 'warning' : 'default'}
          />
          <StatCard
            title="Collection Rate"
            value={`${summary?.collection_rate || 0}%`}
            subtitle="Revenue collected"
            icon={TrendingUp}
          />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Orders & Customers</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Sales Orders"
            value={summary?.total_sales_orders || 0}
            subtitle="Orders in period"
            icon={ShoppingBag}
            link="/sales-orders"
          />
          <StatCard
            title="Active Customers"
            value={summary?.active_customers || 0}
            subtitle="Customers with orders"
            icon={Building2}
            link="/customers"
          />
          <StatCard
            title="Avg Order Value"
            value={formatINR(summary?.avg_order_value || 0)}
            subtitle="Per sales order"
            icon={BarChart3}
          />
          <StatCard
            title="Overdue Invoices"
            value={summary?.overdue_invoices || 0}
            subtitle="Past due date"
            icon={Clock}
            variant={(summary?.overdue_invoices || 0) > 0 ? 'danger' : 'default'}
            link="/invoices"
          />
          <StatCard
            title="High Risk Customers"
            value={summary?.high_risk_count || 0}
            subtitle="Need attention"
            icon={ShieldAlert}
            variant={(summary?.high_risk_count || 0) > 0 ? 'danger' : 'default'}
          />
        </div>
      </div>

      {/* ═══════════════════ CHART 1 + 2: Revenue & Cash Flow ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Revenue vs Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Collections</CardTitle>
            <CardDescription>Monthly invoiced revenue and payments received</CardDescription>
          </CardHeader>
          <CardContent>
            {(charts?.revenue_vs_collections?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={charts!.revenue_vs_collections} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0e696e" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#0e696e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCollections" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v: number) => formatINR(v, true)} />
                  <Tooltip content={<RevenueCollectionsTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" fill="url(#gradRevenue)" stroke="none" />
                  <Area type="monotone" dataKey="collections" fill="url(#gradCollections)" stroke="none" />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0e696e" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="collections" name="Collections" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">No revenue data in this period</div>
            )}
          </CardContent>
        </Card>

        {/* Cash In vs Cash Out */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cash Flow</CardTitle>
            <CardDescription>Cash inflow (customer payments) vs outflow (purchase costs)</CardDescription>
          </CardHeader>
          <CardContent>
            {(charts?.cash_flow?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={charts!.cash_flow} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradCashIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCashOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v: number) => formatINR(v, true)} />
                  <Tooltip content={<CashFlowTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="cash_in" fill="url(#gradCashIn)" stroke="none" />
                  <Area type="monotone" dataKey="cash_out" fill="url(#gradCashOut)" stroke="none" />
                  <Line type="monotone" dataKey="cash_in" name="Cash In" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="cash_out" name="Cash Out" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="net" name="Net Flow" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">No cash flow data in this period</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ CHART 3 + 4: Sales Trend & Payment Methods ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Sales Order Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Sales Order Trend</CardTitle>
                <CardDescription>Monthly order count and invoiced value</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/sales-orders">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(charts?.sales_order_trend?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={charts!.sales_order_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="gradOrderBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0e696e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#0e696e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis yAxisId="left" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} tickFormatter={(v: number) => formatINR(v, true)} />
                  <Tooltip content={<SalesOrderTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="order_count" name="Orders" fill="url(#gradOrderBar)" radius={[4, 4, 0, 0]} barSize={32} />
                  <Line yAxisId="right" type="monotone" dataKey="order_value" name="Order Value" stroke="#0e696e" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No sales order data in this period</div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment Methods</CardTitle>
                <CardDescription>Distribution by payment method</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/payments">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(charts?.payment_method_distribution?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={charts!.payment_method_distribution.map((d) => ({
                    ...d,
                    label: d.method.replace(/_/g, ' '),
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(v: number) => formatINR(v, true)}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip content={<PaymentMethodTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar
                    dataKey="total_amount"
                    name="Total Amount"
                    barSize={24}
                    radius={[0, 4, 4, 0]}
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const color = PAYMENT_METHOD_COLORS[payload.method] || '#94a3b8';
                      return <rect x={x} y={y} width={width} height={height} rx={4} ry={4} fill={color} opacity={0.85} />;
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No payment data in this period</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ TOP PERFORMERS + HIGH RISK ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Top 5 Performers Bar Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />Top 5 Performers
                </CardTitle>
                <CardDescription>Companies with highest revenue in this period</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/customers">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(charts?.top_performers?.length || 0) > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={charts!.top_performers.map((d) => ({
                    ...d,
                    short_name: d.customer_name.length > 18 ? d.customer_name.slice(0, 16) + '…' : d.customer_name,
                  }))}
                  margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  barCategoryGap="20%"
                >
                  <defs>
                    {PERFORMER_COLORS.map((color, i) => (
                      <linearGradient key={i} id={`perfGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="short_name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(v: number) => formatINR(v, true)}
                  />
                  <Tooltip content={<TopPerformerTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Bar dataKey="total_revenue" name="Revenue" radius={[6, 6, 0, 0]} barSize={48}>
                    {charts!.top_performers.map((_, idx) => (
                      <Cell key={idx} fill={`url(#perfGrad${idx})`} />
                    ))}
                  </Bar>
                  <Bar dataKey="total_collected" name="Collected" radius={[6, 6, 0, 0]} barSize={48} opacity={0.4}>
                    {charts!.top_performers.map((_, idx) => (
                      <Cell key={idx} fill={PERFORMER_COLORS[idx]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                No customer revenue data in this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* High Risk Customer Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-red-500" />High Risk Customers
                </CardTitle>
                <CardDescription>Customers with overdue payments or poor collection rates</CardDescription>
              </div>
              {(summary?.high_risk_count || 0) > 0 && (
                <Badge variant="destructive">
                  {summary?.high_risk_count} alert{(summary?.high_risk_count || 0) !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!tables?.high_risk_customers?.length ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center mb-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <p className="text-sm font-medium text-foreground">All Clear</p>
                <p className="text-xs">No high-risk customers detected in this period</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {tables.high_risk_customers.map((c) => {
                  const config = RISK_CONFIG[c.risk_level];
                  const RiskIcon = config.icon;
                  return (
                    <div
                      key={c.customer_id}
                      className={`p-3 rounded-lg border ${config.border} ${config.bg} transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${config.color}`}>
                          <RiskIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold truncate">{c.customer_name}</p>
                            <Badge variant={config.badge} className="text-[10px] uppercase shrink-0">
                              {c.risk_level}
                            </Badge>
                          </div>
                          {/* Risk reasons */}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {c.reasons.map((reason, idx) => (
                              <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded-md bg-background/60 text-muted-foreground border">
                                {reason}
                              </span>
                            ))}
                          </div>
                          {/* Financial summary */}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Outstanding</p>
                              <p className={`font-medium ${config.color}`}>{formatINR(c.outstanding)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Overdue</p>
                              <p className="font-medium">{formatINR(c.overdue_amount)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Collection</p>
                              <p className="font-medium">{c.collection_rate}%</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ TABLES ═══════════════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Top Customers */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />Top Customers
                </CardTitle>
                <CardDescription>By revenue in this period</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/customers">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!tables?.top_customers?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No customer data yet</p>
            ) : (
              <div className="space-y-2">
                {tables.top_customers.slice(0, 8).map((c, idx) => (
                  <div key={c.customer_id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{c.order_count} invoice{c.order_count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatINR(c.total_revenue)}</p>
                      {c.total_outstanding > 0 && (
                        <p className="text-xs text-orange-600">Due: {formatINR(c.total_outstanding)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Invoices */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />Overdue Invoices
                </CardTitle>
                <CardDescription>Invoices past their due date</CardDescription>
              </div>
              <Badge variant={(tables?.overdue_invoices?.length || 0) > 0 ? 'destructive' : 'secondary'}>
                {tables?.overdue_invoices?.length || 0}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Aging Buckets */}
            {(tables?.overdue_invoices?.length || 0) > 0 && (
              <div className="flex gap-2 mb-3">
                {Object.entries(agingBuckets).map(([bucket, count]) => (
                  count > 0 ? (
                    <Badge key={bucket} variant="outline" className="text-xs">
                      {bucket}d: {count}
                    </Badge>
                  ) : null
                ))}
              </div>
            )}
            {!tables?.overdue_invoices?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No overdue invoices</p>
            ) : (
              <div className="space-y-2">
                {tables.overdue_invoices.slice(0, 6).map((inv) => (
                  <Link key={inv.id} to="/invoices" className="block p-2 rounded-md hover:bg-accent transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{inv.customer_name}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-medium text-red-600">{formatINR(inv.amount_due)}</p>
                        <p className="text-xs text-muted-foreground">
                          {inv.days_overdue}d overdue
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payments */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />Recent Payments
                </CardTitle>
                <CardDescription>Latest payments received</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/payments">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!tables?.recent_payments?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {tables.recent_payments.slice(0, 6).map((p) => (
                  <div key={p.id} className="p-2 rounded-md border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.payment_number}</p>
                        <p className="text-xs text-muted-foreground">{p.customer_name}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-medium text-green-600">{formatINR(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.payment_method.replace(/_/g, ' ')} &middot; {format(new Date(p.payment_date), 'MMM dd')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ INVOICE STATUS + QUICK NAV ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Invoice Status Distribution */}
        {(charts?.invoice_status_distribution?.length || 0) > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Invoice Status</CardTitle>
                  <CardDescription>Distribution of invoices by status</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/invoices">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {charts!.invoice_status_distribution.map((s) => {
                  const pct = data && summary && summary.total_revenue > 0
                    ? (s.total_value / summary.total_revenue) * 100
                    : 0;
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <span
                        className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ background: STATUS_COLORS[s.status] || '#94a3b8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{s.status.replace(/_/g, ' ')}</span>
                          <span className="text-sm text-muted-foreground">{s.count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s.status] || '#94a3b8' }}
                          />
                        </div>
                      </div>
                      <span className="text-sm font-medium w-24 text-right">{formatINR(s.total_value)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Navigation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Navigation</CardTitle>
            <CardDescription>Jump to specific sales & customer pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link to="/customers">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <Building2 className="mr-3 h-5 w-5 text-primary" />
                  <div className="text-left"><div className="font-medium">Customers</div><div className="text-xs text-muted-foreground">Manage customer accounts</div></div>
                </Button>
              </Link>
              <Link to="/sales-orders">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <ShoppingCart className="mr-3 h-5 w-5 text-primary" />
                  <div className="text-left"><div className="font-medium">Sales Orders</div><div className="text-xs text-muted-foreground">Create & track orders</div></div>
                </Button>
              </Link>
              <Link to="/invoices">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <FileText className="mr-3 h-5 w-5 text-primary" />
                  <div className="text-left"><div className="font-medium">Invoices</div><div className="text-xs text-muted-foreground">Generate & send invoices</div></div>
                </Button>
              </Link>
              <Link to="/payments">
                <Button variant="outline" className="w-full justify-start h-auto py-3">
                  <Wallet className="mr-3 h-5 w-5 text-primary" />
                  <div className="text-left"><div className="font-medium">Payments</div><div className="text-xs text-muted-foreground">Record & track payments</div></div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
