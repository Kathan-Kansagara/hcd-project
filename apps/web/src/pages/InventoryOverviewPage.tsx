import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Package,
  Box,
  Factory,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  PackageCheck,
  Layers,
  ArrowRight,
  ExternalLink,
  ListChecks,
} from 'lucide-react';
import {
  ComposedChart,
  LineChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';

import { analyticsService } from '@/services/analytics.service';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

/* ──────────────── custom tooltips ──────────────── */

function ProductStockTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const pct = d.produced > 0 ? ((d.remaining / d.produced) * 100).toFixed(0) : '0';
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.product}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e' }} />
          Remaining: <strong>{d.remaining.toFixed(1)} L</strong>
        </p>
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: '#0e696e33' }} />
          Used: <strong>{d.used.toFixed(1)} L</strong>
        </p>
        <p className="text-muted-foreground pt-0.5">
          {pct}% remaining &middot; {d.batches} batch{d.batches !== 1 ? 'es' : ''}
        </p>
      </div>
    </div>
  );
}

function RMStockTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const isBelowMin = d.min_level > 0 && d.stock < d.min_level;
  return (
    <div style={TOOLTIP_STYLE} className="shadow-lg">
      <p className="font-semibold text-sm mb-1">{d.name}</p>
      <p className="text-[10px] text-muted-foreground mb-1">{d.code}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5" style={{ background: isBelowMin ? '#ef4444' : '#0e696e' }} />
          Stock: <strong>{d.stock.toFixed(1)} {d.unit}</strong>
        </p>
        {d.min_level > 0 && (
          <p>
            <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 border border-red-400" style={{ background: 'transparent' }} />
            Min Level: <strong className={isBelowMin ? 'text-red-600' : ''}>{d.min_level.toFixed(1)} {d.unit}</strong>
          </p>
        )}
        <p className="text-muted-foreground pt-0.5">
          Value: ₹{d.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  );
}

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

/* ═══════════════════ PAGE ═══════════════════ */

export default function InventoryOverviewPage() {
  useBreadcrumbs([{ label: 'Inventory & Production Overview' }]);

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-production-overview'],
    queryFn: () => analyticsService.getInventoryProductionOverview(90),
  });

  const summary = data?.summary;
  const charts = data?.charts;
  const alerts = data?.alerts;
  const recentProduction = data?.recent_production;

  /* ── loading skeleton ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory & Production Overview</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Complete overview of your inventory and production status</p>
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
          {[...Array(2)].map((_, i) => (
            <Card key={i}><CardHeader><Skeleton className="h-5 w-32" /></CardHeader><CardContent><Skeleton className="h-[300px] w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const stockUtil = summary && summary.total_produced_stock > 0
    ? ((summary.total_finished_stock / summary.total_produced_stock) * 100).toFixed(0)
    : '0';

  /* ── prepare chart data ── */

  // 1. Combined time-series (production + movements) — forecasting-ready
  const timeSeriesData = (() => {
    const map: Record<string, any> = {};
    charts?.production_trend?.forEach((p) => {
      map[p.month] = { month: p.month, production: p.total_quantity, batches: p.batches_count, purchase: 0, sale: 0, consumption: 0 };
    });
    charts?.movements_trend?.forEach((m) => {
      if (!map[m.month]) map[m.month] = { month: m.month, production: 0, batches: 0, purchase: 0, sale: 0, consumption: 0 };
      map[m.month].purchase = m.PURCHASE;
      map[m.month].sale = m.SALE;
      map[m.month].consumption = m.PRODUCTION_CONSUMPTION;
    });
    // Later: add forecast_production, forecast_purchase, etc. keys here
    return Object.values(map);
  })();

  // 2. Product stock — stacked (used + remaining = produced), forecasting-ready
  const productStockData = (charts?.stock_by_product || []).map((p) => ({
    product: p.product.length > 18 ? p.product.slice(0, 16) + '…' : p.product,
    fullName: p.product,
    remaining: p.remaining,
    used: p.produced - p.remaining,
    produced: p.produced,
    batches: p.batches,
    // Later: forecast_demand, days_of_stock, etc.
  }));

  // 3. RM stock levels — bar + reference line for min, forecasting-ready
  const rmStockData = (charts?.rm_stock_levels || []).map((rm) => ({
    label: rm.name.length > 16 ? rm.name.slice(0, 14) + '…' : rm.name,
    name: rm.name,
    code: rm.code,
    stock: rm.stock,
    min_level: rm.min_level,
    value: rm.value,
    unit: rm.unit,
    // Later: forecast_consumption, days_until_stockout, reorder_qty, etc.
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Inventory & Production Overview</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Complete overview of your inventory and production status</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" asChild><Link to="/raw-materials"><Box className="mr-2 h-4 w-4" />Raw Materials</Link></Button>
          <Button asChild><Link to="/production"><Factory className="mr-2 h-4 w-4" />Production</Link></Button>
        </div>
      </div>

      {/* Inventory Summary */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Inventory Summary</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Products" value={summary?.total_products || 0} subtitle="Finished products defined" icon={Package} link="/products" />
          <StatCard title="Raw Materials" value={summary?.total_raw_materials || 0} subtitle="Active raw materials" icon={Box} link="/raw-materials" />
          <StatCard title="RM Stock Value" value={`₹${(summary?.total_rm_stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} subtitle="Total raw material value" icon={TrendingUp} />
          <StatCard title="Product Recipes" value={summary?.products_with_bom || 0} subtitle="Products with BOM" icon={ListChecks} link="/bom" />
        </div>
      </div>

      {/* Production & Stock */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Production & Stock</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Batches" value={summary?.total_finished_batches || 0} subtitle="Finished product batches" icon={PackageCheck} link="/production" />
          <StatCard title="RM Batches" value={summary?.total_rm_batches || 0} subtitle="Active raw material batches" icon={Layers} link="/rm-batches" />
          <StatCard title="Total Stock" value={`${(summary?.total_finished_stock || 0).toFixed(1)} L`} subtitle={`${stockUtil}% stock remaining`} icon={BarChart3} />
          <StatCard title="Low Stock RM" value={summary?.low_stock_rm_count || 0} subtitle="Below minimum level" icon={AlertTriangle} variant={(summary?.low_stock_rm_count || 0) > 0 ? 'danger' : 'default'} link="/raw-materials" />
        </div>
      </div>

      {/* Expiry Alerts */}
      {((summary?.expiring_finished_count || 0) > 0 || (summary?.expiring_rm_count || 0) > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard title="Expiring Product Batches" value={summary?.expiring_finished_count || 0} subtitle="Finished batches expiring in 30 days" icon={AlertTriangle} variant="warning" />
          <StatCard title="Expiring RM Batches" value={summary?.expiring_rm_count || 0} subtitle="RM batches expiring in 30 days" icon={AlertTriangle} variant="warning" />
        </div>
      )}

      {/* ═══════════════════ CHART 1: Production & Stock Movements (line) ═══════════════════ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Production & Stock Movements</CardTitle>
          <CardDescription>Production output, purchases, sales, and consumption over time</CardDescription>
        </CardHeader>
        <CardContent>
          {timeSeriesData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={timeSeriesData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  {/* gradient for future forecast area fill */}
                  <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0e696e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#0e696e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <YAxis tick={AXIS_TICK} axisLine={{ stroke: 'hsl(var(--border))' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="production" name="Production" stroke="#0e696e" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="purchase" name="Purchases" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="sale" name="Sales" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="consumption" name="Consumption" stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                {/* FORECASTING: add lines here later, e.g.:
                  <Line type="monotone" dataKey="forecast_production" name="Forecast" stroke="#0e696e" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Area type="monotone" dataKey="forecast_upper" fill="url(#gradForecast)" stroke="none" />
                */}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground">No production or movement data in this period</div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ CHART 2 + 3: Product Stock & RM Stock ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* ── Product Stock (ComposedChart — stacked bar, forecasting-ready) ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Finished Product Stock</CardTitle>
                <CardDescription>Stock utilization by product (remaining vs used)</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/production">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {productStockData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(productStockData.length * 52 + 50, 200)}>
                <ComposedChart
                  data={productStockData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
                  barGap={0}
                  barCategoryGap="25%"
                >
                  <defs>
                    <linearGradient id="gradRemaining" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0e696e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="gradUsed" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e2e8f0" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickFormatter={(v: number) => `${v}L`}
                  />
                  <YAxis
                    type="category"
                    dataKey="product"
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip content={<ProductStockTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="remaining" name="Remaining" stackId="stock" fill="url(#gradRemaining)" radius={[0, 0, 0, 0]} barSize={22} />
                  <Bar dataKey="used" name="Used" stackId="stock" fill="url(#gradUsed)" radius={[0, 4, 4, 0]} barSize={22} />
                  {/* FORECASTING: overlay a line for forecast demand per product:
                    <Line type="monotone" dataKey="forecast_demand" name="Forecast Demand" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                  */}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">No product stock data available</div>
            )}
          </CardContent>
        </Card>

        {/* ── RM Stock Levels (ComposedChart — bar + ref lines, forecasting-ready) ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Raw Material Stock Levels</CardTitle>
                <CardDescription>Current stock vs minimum level (top 10 by value)</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/raw-materials">View All<ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rmStockData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(rmStockData.length * 52 + 50, 200)}>
                <ComposedChart
                  data={rmStockData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 5, left: 5 }}
                  barCategoryGap="25%"
                >
                  <defs>
                    <linearGradient id="gradRMStock" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0e696e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gradRMDanger" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={AXIS_TICK}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip content={<RMStockTooltip />} cursor={{ fill: 'hsl(var(--accent))' }} />
                  <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="stock"
                    name="Current Stock"
                    barSize={22}
                    radius={[0, 4, 4, 0]}
                    // Colour each bar based on whether it's below min level
                    fill="url(#gradRMStock)"
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const isBelowMin = payload.min_level > 0 && payload.stock < payload.min_level;
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          rx={4}
                          ry={4}
                          fill={isBelowMin ? 'url(#gradRMDanger)' : 'url(#gradRMStock)'}
                        />
                      );
                    }}
                  />
                  <Bar
                    dataKey="min_level"
                    name="Min Level"
                    barSize={6}
                    radius={[0, 2, 2, 0]}
                    fill="#ef444455"
                  />
                  {/* FORECASTING: overlay lines per material for projected consumption:
                    <Line type="monotone" dataKey="forecast_consumption" name="Forecast Usage" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="reorder_qty" name="Reorder Qty" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                  */}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">No raw material stock data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════ ALERTS & RECENT PRODUCTION ═══════════════════ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" />Low Stock Raw Materials</CardTitle>
                <CardDescription>Below minimum inventory level</CardDescription>
              </div>
              <Badge variant={alerts?.low_stock_raw_materials?.length ? 'destructive' : 'secondary'}>{alerts?.low_stock_raw_materials?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!alerts?.low_stock_raw_materials?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">All raw materials are well stocked</p>
            ) : (
              <div className="space-y-2">
                {alerts.low_stock_raw_materials.slice(0, 5).map((rm) => (
                  <Link key={rm.id} to="/raw-materials" className="block p-2 rounded-md hover:bg-accent transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rm.name}</p>
                        <p className="text-xs text-muted-foreground">{rm.code}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="text-sm font-medium text-red-600">{rm.current_stock.toFixed(1)} {rm.unit}</p>
                        <p className="text-xs text-muted-foreground">Min: {rm.min_level.toFixed(1)}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Batches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Expiring Batches</CardTitle>
                <CardDescription>Batches expiring within 30 days</CardDescription>
              </div>
              <Badge variant={(alerts?.expiring_finished_batches?.length || 0) + (alerts?.expiring_rm_batches?.length || 0) > 0 ? 'destructive' : 'secondary'}>
                {(alerts?.expiring_finished_batches?.length || 0) + (alerts?.expiring_rm_batches?.length || 0)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!alerts?.expiring_finished_batches?.length && !alerts?.expiring_rm_batches?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No batches expiring soon</p>
            ) : (
              <div className="space-y-2">
                {alerts?.expiring_finished_batches?.slice(0, 3).map((b) => {
                  const daysLeft = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86_400_000);
                  return (
                    <Link key={b.id} to="/production" className="block p-2 rounded-md hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{b.batch_number}</p><p className="text-xs text-muted-foreground">{b.product_name}</p></div>
                        <div className="text-right ml-2"><p className="text-sm font-medium text-orange-600">{daysLeft}d left</p><p className="text-xs text-muted-foreground">{format(new Date(b.expiry_date), 'MMM dd')}</p></div>
                        <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
                {alerts?.expiring_rm_batches?.slice(0, 2).map((b) => {
                  const daysLeft = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / 86_400_000);
                  return (
                    <Link key={b.id} to="/rm-batches" className="block p-2 rounded-md hover:bg-accent transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{b.batch_number}</p><p className="text-xs text-muted-foreground">{b.rm_name} (RM)</p></div>
                        <div className="text-right ml-2"><p className="text-sm font-medium text-orange-600">{daysLeft}d left</p><p className="text-xs text-muted-foreground">{format(new Date(b.expiry_date), 'MMM dd')}</p></div>
                        <ExternalLink className="h-4 w-4 ml-2 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Production */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2"><Factory className="h-5 w-5 text-primary" />Recent Production</CardTitle>
                <CardDescription>Latest production batches</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild><Link to="/production">View All<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </CardHeader>
          <CardContent>
            {!recentProduction?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No production batches yet</p>
            ) : (
              <div className="space-y-2">
                {recentProduction.slice(0, 5).map((b) => (
                  <div key={b.id} className="p-2 rounded-md border">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{b.batch_number}</p><p className="text-xs text-muted-foreground">{b.product_name}</p></div>
                      <div className="text-right ml-2"><p className="text-sm font-medium">{b.quantity_produced} {b.unit}</p><p className="text-xs text-muted-foreground">{format(new Date(b.created_at), 'MMM dd, yyyy')}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Navigation</CardTitle>
          <CardDescription>Jump to specific inventory & production pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/products"><Button variant="outline" className="w-full justify-start h-auto py-3"><Package className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Products</div><div className="text-xs text-muted-foreground">Manage finished products</div></div></Button></Link>
            <Link to="/raw-materials"><Button variant="outline" className="w-full justify-start h-auto py-3"><Box className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Raw Materials</div><div className="text-xs text-muted-foreground">View & manage raw materials</div></div></Button></Link>
            <Link to="/bom"><Button variant="outline" className="w-full justify-start h-auto py-3"><ListChecks className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Product Recipes</div><div className="text-xs text-muted-foreground">BOM & formulations</div></div></Button></Link>
            <Link to="/production"><Button variant="outline" className="w-full justify-start h-auto py-3"><Factory className="mr-3 h-5 w-5 text-primary" /><div className="text-left"><div className="font-medium">Production</div><div className="text-xs text-muted-foreground">Create & track batches</div></div></Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
