import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatDate } from '../utils/helpers';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers?search=${search}&page=${page}&limit=30`);
      setCustomers(res.data.customers);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب العملاء');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [search, page]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">العملاء</h1>
          <p className="text-sm text-gray-400 mt-1">يتم إنشاء العملاء تلقائياً عند تقديم الطلبات</p>
        </div>
        <div className="text-sm text-gray-500 bg-brand-900/50 px-4 py-2 rounded-xl border border-brand-800/30">
          إجمالي: <span className="text-brand-400 font-bold">{pagination.total || 0}</span> عميل
        </div>
      </div>

      <div className="glass rounded-xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث بالاسم أو الهاتف أو كود العميل..."
          className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
        />
      </div>

      {loading ? (
        <LoadingSpinner text="جاري تحميل العملاء..." />
      ) : customers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-400 text-lg">لا توجد عملاء</p>
          <p className="text-gray-500 text-sm mt-1">يتم إنشاء العملاء تلقائياً عند تقديم طلب جديد</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                  <th className="text-right p-4 font-medium">كود العميل</th>
                  <th className="text-right p-4 font-medium">الاسم</th>
                  <th className="text-right p-4 font-medium">الهاتف</th>
                  <th className="text-right p-4 font-medium">الطلبات</th>
                  <th className="text-right p-4 font-medium">المرتجعات</th>
                  <th className="text-right p-4 font-medium">التاريخ</th>
                  <th className="text-right p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-brand-800/20 table-row-hover transition-colors cursor-pointer" onClick={() => navigate(`/admin/customers/${c.id}`)}>
                    <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{c.customerCode}</td>
                    <td className="p-4 text-sm text-white font-medium">{c.name}</td>
                    <td className="p-4 text-sm text-gray-400" dir="ltr">{c.phone}</td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                        {c._count?.orders || 0}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
                        {c._count?.returns || 0}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                    <td className="p-4">
                      <span className="text-sm text-brand-400">عرض ←</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-brand-800/30">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${page === i + 1 ? 'bg-brand-500 text-white' : 'text-gray-400 hover:bg-brand-800/50'}`}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
