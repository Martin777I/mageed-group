import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, statusMap } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('orders');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [custRes, ordersRes, returnsRes] = await Promise.all([
          api.get(`/customers/${id}`),
          api.get(`/customers/${id}/orders?limit=50`),
          api.get(`/customers/${id}/returns`),
        ]);
        setCustomer(custRes.data);
        setOrders(ordersRes.data.orders || []);
        setReturns(returnsRes.data || []);
      } catch {
        toast.error('العميل غير موجود');
        navigate('/admin/customers');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <LoadingSpinner text="جاري تحميل بيانات العميل..." />;
  if (!customer) return null;

  const stats = customer.stats || {};

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/customers')} className="w-10 h-10 rounded-xl border border-brand-800/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-800/50 transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">{customer.name}</h1>
          <p className="text-sm text-brand-400 font-mono" dir="ltr">{customer.customerCode}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="glass rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-4">بيانات العميل</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">الهاتف</p>
            <p className="text-white font-medium" dir="ltr">{customer.phone}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">العنوان</p>
            <p className="text-white">{customer.address || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">تاريخ التسجيل</p>
            <p className="text-white">{formatDate(customer.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">آخر طلب</p>
            <p className="text-white">{stats.lastOrderDate ? formatDate(stats.lastOrderDate) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'الطلبات', value: stats.totalOrders || 0, icon: '📦', color: 'text-blue-400' },
          { label: 'المرتجعات', value: stats.totalReturns || 0, icon: '↩️', color: 'text-orange-400' },
          { label: 'إجمالي المشتريات', value: formatCurrency(stats.totalPurchases || 0), icon: '💰', color: 'text-green-400' },
          { label: 'إجمالي المرتجعات', value: formatCurrency(stats.totalReturnsAmount || 0), icon: '📉', color: 'text-red-400' },
          { label: 'صافي المشتريات', value: formatCurrency(stats.netPurchases || 0), icon: '📊', color: 'text-accent-400' },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-brand-800/30 pb-0">
        {[
          { key: 'orders', label: `الطلبات (${orders.length})` },
          { key: 'returns', label: `المرتجعات (${returns.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
              tab === t.key
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Orders Tab */}
      {tab === 'orders' && (
        <div className="glass rounded-2xl overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">لا توجد طلبات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                    <th className="text-right p-4 font-medium">رقم الطلب</th>
                    <th className="text-right p-4 font-medium">الحالة</th>
                    <th className="text-right p-4 font-medium">المنتجات</th>
                    <th className="text-right p-4 font-medium">الإجمالي</th>
                    <th className="text-right p-4 font-medium">المرتجعات</th>
                    <th className="text-right p-4 font-medium">التاريخ</th>
                    <th className="text-right p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const st = statusMap[o.status] || statusMap.pending;
                    return (
                      <tr key={o.id} className="border-b border-brand-800/20 table-row-hover">
                        <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{o.orderNumber}</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium border ${st.color}`}>{st.label}</span></td>
                        <td className="p-4 text-sm text-gray-400">{o.items?.length || 0}</td>
                        <td className="p-4 text-sm text-accent-400 font-bold">{formatCurrency(o.totalAmount)}</td>
                        <td className="p-4 text-sm text-orange-400">{o.returns?.length || 0}</td>
                        <td className="p-4 text-sm text-gray-500">{formatDate(o.createdAt)}</td>
                        <td className="p-4">
                          <Link to={`/admin/orders/${o.id}`} className="text-sm text-brand-400 hover:text-brand-300">عرض</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Returns Tab */}
      {tab === 'returns' && (
        <div className="glass rounded-2xl overflow-hidden">
          {returns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">لا توجد مرتجعات</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                    <th className="text-right p-4 font-medium">رقم المرتجع</th>
                    <th className="text-right p-4 font-medium">رقم الطلب</th>
                    <th className="text-right p-4 font-medium">المنتجات</th>
                    <th className="text-right p-4 font-medium">الإجمالي</th>
                    <th className="text-right p-4 font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r) => (
                    <tr key={r.id} className="border-b border-brand-800/20 table-row-hover">
                      <td className="p-4 text-sm text-orange-400 font-mono" dir="ltr">{r.returnNumber}</td>
                      <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{r.order?.orderNumber}</td>
                      <td className="p-4 text-sm text-gray-400">{r.items?.length || 0}</td>
                      <td className="p-4 text-sm text-red-400 font-bold">{formatCurrency(r.totalAmount)}</td>
                      <td className="p-4 text-sm text-gray-500">{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
