import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency } from '../utils/helpers';

const emptyProduct = { code: '', name: '', price: '', retailPrice: '', category: '', stock: '0', companyId: '' };

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companySearch, setCompanySearch] = useState('');
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products?search=${search}&page=${page}&limit=30`);
      setProducts(res.data.products);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب المنتجات');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/companies?limit=200&activeOnly=true');
      setCompanies(res.data.companies || []);
    } catch {
      // silent
    }
  };

  useEffect(() => { fetchProducts(); }, [search, page]);
  useEffect(() => { fetchCompanies(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyProduct);
    setCompanySearch('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      price: String(p.price),
      retailPrice: p.retailPrice != null ? String(p.retailPrice) : '',
      category: p.category || '',
      stock: String(p.stock),
      companyId: p.companyId ? String(p.companyId) : '',
    });
    setCompanySearch(p.company?.name || '');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.price) {
      toast.error('الكود والاسم والسعر مطلوبون');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        companyId: form.companyId ? parseInt(form.companyId) : null,
      };
      if (editing) {
        await api.put(`/products/${editing.id}`, payload);
        toast.success('تم تحديث المنتج');
      } else {
        await api.post('/products', payload);
        toast.success('تم إضافة المنتج');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ المنتج');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('تم حذف المنتج');
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حذف المنتج');
    }
  };

  const toggleActive = async (product) => {
    try {
      await api.put(`/products/${product.id}`, { isActive: !product.isActive });
      fetchProducts();
    } catch {
      toast.error('خطأ في تحديث حالة المنتج');
    }
  };

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(companySearch.toLowerCase())
  );

  const selectedCompany = companies.find((c) => String(c.id) === form.companyId);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">المنتجات</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/import')}
            className="px-4 py-2 rounded-xl border border-brand-700/50 text-brand-400 hover:bg-brand-800/50 text-sm font-medium transition-all flex items-center gap-2"
          >
            📥 استيراد Excel
          </button>
          <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all shadow-lg shadow-brand-500/20">
            + إضافة منتج
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث بالكود أو الاسم أو الفئة..."
          className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل المنتجات..." />
      ) : products.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg">لا توجد منتجات</p>
          <p className="text-gray-500 text-sm mt-1">أضف منتجات يدوياً أو استورد من ملف Excel</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                  <th className="text-right p-4 font-medium">الكود</th>
                  <th className="text-right p-4 font-medium">الاسم</th>
                  <th className="text-right p-4 font-medium">الشركة</th>
                  <th className="text-right p-4 font-medium">سعر الجملة</th>
                  <th className="text-right p-4 font-medium">سعر القطاعي</th>
                  <th className="text-right p-4 font-medium">الفئة</th>
                  <th className="text-right p-4 font-medium">المخزون</th>
                  <th className="text-right p-4 font-medium">الحالة</th>
                  <th className="text-right p-4 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-brand-800/20 table-row-hover transition-colors">
                    <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{p.code}</td>
                    <td className="p-4 text-sm text-white">{p.name}</td>
                    <td className="p-4 text-sm">
                      {p.company ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border border-brand-800/30 bg-brand-900/50">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.company.color || '#3b82f6' }} />
                          {p.company.name}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-accent-400 font-bold">{formatCurrency(p.price)}</td>
                    <td className="p-4 text-sm text-green-400 font-bold">{p.retailPrice != null ? formatCurrency(p.retailPrice) : <span className="text-gray-600 font-normal">—</span>}</td>
                    <td className="p-4 text-sm text-gray-400">{p.category || '—'}</td>
                    <td className="p-4 text-sm text-gray-400">{p.stock}</td>
                    <td className="p-4">
                      <button onClick={() => toggleActive(p)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${p.isActive ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                        {p.isActive ? 'نشط' : 'معطل'}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg text-brand-400 hover:bg-brand-800/50 flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setShowCompanyDropdown(false); }} title={editing ? 'تعديل المنتج' : 'إضافة منتج جديد'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">كود المنتج</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BRK-001" dir="ltr" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">اسم المنتج</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="تيل فرامل أمامي" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" required />
            </div>
          </div>

          {/* Company Dropdown */}
          <div className="relative">
            <label className="block text-sm text-gray-400 mb-1">الشركة</label>
            <div
              className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-sm cursor-pointer flex items-center justify-between transition-all hover:border-brand-700/50"
              onClick={() => setShowCompanyDropdown(!showCompanyDropdown)}
            >
              {selectedCompany ? (
                <span className="flex items-center gap-2 text-white">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCompany.color || '#3b82f6' }} />
                  {selectedCompany.name}
                </span>
              ) : (
                <span className="text-gray-500">اختر الشركة (اختياري)</span>
              )}
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>

            {showCompanyDropdown && (
              <div className="absolute z-50 top-full mt-1 w-full bg-brand-900 border border-brand-800/50 rounded-xl shadow-2xl shadow-black/50 max-h-56 overflow-hidden">
                <div className="p-2 border-b border-brand-800/30">
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="بحث عن شركة..."
                    className="w-full px-3 py-2 rounded-lg bg-brand-800/50 border border-brand-700/30 text-white text-sm placeholder-gray-500 focus:border-brand-500"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, companyId: '' }); setCompanySearch(''); setShowCompanyDropdown(false); }}
                    className="w-full text-right px-3 py-2 text-sm text-gray-500 hover:bg-brand-800/50 transition-colors"
                  >
                    بدون شركة
                  </button>
                  {filteredCompanies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setForm({ ...form, companyId: String(c.id) }); setCompanySearch(c.name); setShowCompanyDropdown(false); }}
                      className="w-full text-right px-3 py-2 text-sm text-white hover:bg-brand-800/50 transition-colors flex items-center gap-2"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color || '#3b82f6' }} />
                      {c.name}
                      <span className="text-gray-600 text-xs mr-auto">{c._count?.products || 0} منتج</span>
                    </button>
                  ))}
                  {filteredCompanies.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-500 text-center">لا توجد نتائج</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">سعر الجملة</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" dir="ltr" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" required />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">سعر القطاعي <span className="text-gray-600">(اختياري)</span></label>
              <input type="number" step="0.01" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} placeholder="0.00" dir="ltr" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">الفئة</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="فرامل" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">المخزون</label>
              <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} dir="ltr" className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إضافة'}
            </button>
            <button type="button" onClick={() => { setShowModal(false); setShowCompanyDropdown(false); }} className="px-6 py-2.5 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white text-sm transition-all">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
