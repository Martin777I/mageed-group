import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatCurrency, formatDate, statusMap } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders?status=${statusFilter}&page=${page}&limit=20`);
      setOrders(res.data.orders);
      setPagination(res.data.pagination);
    } catch {
      console.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, page]);

  const filters = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'قيد المراجعة' },
    { value: 'accepted', label: 'مقبول' },
    { value: 'rejected', label: 'مرفوض' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-2xl font-bold text-white">الطلبات</h1>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === f.value
                ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                : 'text-gray-400 border border-brand-800/30 hover:bg-brand-800/30'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل الطلبات..." />
      ) : orders.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg">لا توجد طلبات</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                  <th className="text-right p-4 font-medium">رقم الطلب</th>
                  <th className="text-right p-4 font-medium">العميل</th>
                  <th className="text-right p-4 font-medium">الهاتف</th>
                  <th className="text-right p-4 font-medium">المنتجات</th>
                  <th className="text-right p-4 font-medium">الإجمالي</th>
                  <th className="text-right p-4 font-medium">الحالة</th>
                  <th className="text-right p-4 font-medium">التاريخ</th>
                  <th className="text-right p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const st = statusMap[order.status] || statusMap.pending;
                  return (
                    <tr key={order.id} className="border-b border-brand-800/20 table-row-hover transition-colors">
                      <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{order.orderNumber}</td>
                      <td className="p-4 text-sm text-white">{order.customerName}</td>
                      <td className="p-4 text-sm text-gray-400" dir="ltr">{order.customerPhone}</td>
                      <td className="p-4 text-sm text-gray-400">{order.items.length} منتج</td>
                      <td className="p-4 text-sm text-accent-400 font-bold">{formatCurrency(order.totalAmount)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">{formatDate(order.createdAt)}</td>
                      <td className="p-4">
                        <Link to={`/admin/orders/${order.id}`} className="px-3 py-1.5 rounded-lg bg-brand-800/50 text-brand-400 hover:bg-brand-700/50 text-sm transition-all">
                          عرض
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-brand-800/30">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === i + 1 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-brand-800/50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
