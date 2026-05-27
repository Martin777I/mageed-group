import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatCurrency, formatDate, statusMap } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          api.get('/orders/stats'),
          api.get('/orders?limit=5'),
        ]);
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data.orders || []);
      } catch (err) {
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner text="جاري تحميل لوحة التحكم..." />;
  if (!stats) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'المنتجات', value: stats.totalProducts, icon: '📦', color: 'text-blue-400', gradient: 'from-blue-500/15 to-blue-600/5' },
          { label: 'طلبات اليوم', value: stats.todayOrders, icon: '📋', color: 'text-green-400', gradient: 'from-green-500/15 to-green-600/5' },
          { label: 'طلبات معلقة', value: stats.pendingOrders, icon: '⏳', color: 'text-yellow-400', gradient: 'from-yellow-500/15 to-yellow-600/5' },
          { label: 'إيرادات اليوم', value: formatCurrency(stats.todayRevenue), icon: '💰', color: 'text-accent-400', gradient: 'from-emerald-500/15 to-emerald-600/5' },
          { label: 'العملاء', value: stats.totalCustomers, icon: '👥', color: 'text-purple-400', gradient: 'from-purple-500/15 to-purple-600/5' },
        ].map((s, i) => (
          <div key={i} className={`glass rounded-2xl p-4 bg-gradient-to-br ${s.gradient}`}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'الشركات', value: stats.totalCompanies, icon: '🏢', color: 'text-cyan-400' },
          { label: 'المرتجعات', value: stats.totalReturns || 0, icon: '↩️', color: 'text-orange-400' },
          { label: 'قيمة المرتجعات', value: formatCurrency(stats.totalReturnsAmount || 0), icon: '📉', color: 'text-red-400' },
          { label: 'مبيعات 30 يوم', value: formatCurrency(stats.monthlySales?.amount || 0), icon: '📈', color: 'text-green-400' },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Stock Alerts & Top Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Stock Alerts */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400">⚠️</span>
            تنبيهات المخزون
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.outOfStockProducts || 0}</p>
              <p className="text-xs text-gray-400 mt-1">نفد المخزون</p>
            </div>
            <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20 text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.lowStockProducts || 0}</p>
              <p className="text-xs text-gray-400 mt-1">مخزون منخفض</p>
            </div>
          </div>

          {stats.outOfStockList?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-red-400 font-medium mb-2">منتجات نفدت:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {stats.outOfStockList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{p.name}</span>
                    <span className="text-red-400 font-mono" dir="ltr">{p.code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.lowStockList?.length > 0 && (
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-2">مخزون منخفض:</p>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {stats.lowStockList.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold">{p.stock}</span>
                      <span className="text-gray-600 font-mono" dir="ltr">{p.code}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Selling Products */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center text-green-400">🏆</span>
            أكثر المنتجات مبيعاً
          </h2>
          {stats.topProducts?.length > 0 ? (
            <div className="space-y-3">
              {stats.topProducts.map((tp, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-brand-900/50 border border-brand-800/20">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">{i + 1}</div>
                    <div>
                      <p className="text-white text-sm font-medium">{tp.product?.name || '—'}</p>
                      <p className="text-xs text-gray-500 font-mono" dir="ltr">{tp.product?.code}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-accent-400 text-sm font-bold">{formatCurrency(tp.totalAmount)}</p>
                    <p className="text-xs text-gray-500">{tp.totalQuantity} قطعة</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Top Customers & Top Companies Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top Customers */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">👑</span>
            أفضل العملاء
          </h2>
          {stats.topCustomers?.length > 0 ? (
            <div className="space-y-3">
              {stats.topCustomers.map((tc, i) => (
                <Link key={i} to={tc.customer ? `/admin/customers/${tc.customer.id}` : '#'} className="flex items-center justify-between p-3 rounded-xl bg-brand-900/50 border border-brand-800/20 hover:border-brand-700/40 transition-all block">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold">{i + 1}</div>
                    <div>
                      <p className="text-white text-sm font-medium">{tc.customer?.name || '—'}</p>
                      <p className="text-xs text-gray-500 font-mono" dir="ltr">{tc.customer?.customerCode}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-accent-400 text-sm font-bold">{formatCurrency(tc.totalAmount)}</p>
                    <p className="text-xs text-gray-500">{tc.ordersCount} طلب</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
          )}
        </div>

        {/* Top Companies */}
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center text-cyan-400">🏢</span>
            أكثر الشركات مبيعاً
          </h2>
          {stats.topCompanies?.length > 0 ? (
            <div className="space-y-3">
              {stats.topCompanies.map((tc, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-brand-900/50 border border-brand-800/20">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tc.color }} />
                    <p className="text-white text-sm font-medium">{tc.name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-accent-400 text-sm font-bold">{formatCurrency(tc.total)}</p>
                    <p className="text-xs text-gray-500">{tc.quantity} قطعة</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Monthly Overview */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-4">📊 ملخص آخر 30 يوم</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/20">
            <p className="text-2xl font-bold text-green-400">{stats.monthlySales?.count || 0}</p>
            <p className="text-xs text-gray-400 mt-1">طلبات مقبولة</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/20">
            <p className="text-xl font-bold text-green-400">{formatCurrency(stats.monthlySales?.amount || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">إجمالي المبيعات</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
            <p className="text-2xl font-bold text-orange-400">{stats.monthlyReturns?.count || 0}</p>
            <p className="text-xs text-gray-400 mt-1">مرتجعات</p>
          </div>
          <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
            <p className="text-xl font-bold text-orange-400">{formatCurrency(stats.monthlyReturns?.amount || 0)}</p>
            <p className="text-xs text-gray-400 mt-1">قيمة المرتجعات</p>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">آخر الطلبات</h2>
          <Link to="/admin/orders" className="text-sm text-brand-400 hover:text-brand-300">عرض الكل →</Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-4">لا توجد طلبات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                  <th className="text-right pb-3 font-medium">رقم الطلب</th>
                  <th className="text-right pb-3 font-medium">العميل</th>
                  <th className="text-right pb-3 font-medium">الحالة</th>
                  <th className="text-right pb-3 font-medium">الإجمالي</th>
                  <th className="text-right pb-3 font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => {
                  const st = statusMap[o.status] || statusMap.pending;
                  return (
                    <tr key={o.id} className="border-b border-brand-800/20 table-row-hover">
                      <td className="py-3 text-sm">
                        <Link to={`/admin/orders/${o.id}`} className="text-brand-400 hover:text-brand-300 font-mono" dir="ltr">{o.orderNumber}</Link>
                      </td>
                      <td className="py-3 text-sm text-white">{o.customerName}</td>
                      <td className="py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span></td>
                      <td className="py-3 text-sm text-accent-400 font-bold">{formatCurrency(o.totalAmount)}</td>
                      <td className="py-3 text-sm text-gray-500">{formatDate(o.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
