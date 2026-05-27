import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
];

const emptyCompany = { name: '', color: '#3b82f6' };

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyCompany);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const logoRef = useRef(null);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/companies?search=${search}&page=${page}&limit=30`);
      setCompanies(res.data.companies);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب الشركات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, [search, page]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyCompany);
    setLogoFile(null);
    setLogoPreview(null);
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, color: c.color || '#3b82f6' });
    setLogoFile(null);
    setLogoPreview(c.logo ? c.logo : null);
    setShowModal(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 2 ميجابايت');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('اسم الشركة مطلوب');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('color', form.color);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      if (editing) {
        await api.put(`/companies/${editing.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('تم تحديث الشركة');
      } else {
        await api.post('/companies', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('تم إضافة الشركة');
      }
      setShowModal(false);
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حفظ الشركة');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من تعطيل هذه الشركة؟')) return;
    try {
      await api.delete(`/companies/${id}`);
      toast.success('تم تعطيل الشركة');
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في حذف الشركة');
    }
  };

  const toggleActive = async (company) => {
    try {
      await api.put(`/companies/${company.id}`, { isActive: !company.isActive, name: company.name });
      toast.success(company.isActive ? 'تم تعطيل الشركة' : 'تم تفعيل الشركة');
      fetchCompanies();
    } catch {
      toast.error('خطأ في تحديث حالة الشركة');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">الشركات / العلامات التجارية</h1>
          <p className="text-sm text-gray-400 mt-1">إدارة شركات ومصنعي قطع الغيار</p>
        </div>
        <button onClick={openAdd} className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          إضافة شركة
        </button>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="بحث بالاسم..."
          className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
        />
      </div>

      {/* Companies Grid */}
      {loading ? (
        <LoadingSpinner text="جاري تحميل الشركات..." />
      ) : companies.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏢</div>
          <p className="text-gray-400 text-lg">لا توجد شركات</p>
          <p className="text-gray-500 text-sm mt-1">أضف شركة أو استورد منتجات مع عمود الشركة</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((c) => (
              <div key={c.id} className={`glass rounded-2xl p-5 hover:border-brand-500/30 transition-all group ${!c.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {c.logo ? (
                      <img src={c.logo} alt={c.name} className="w-12 h-12 rounded-xl object-cover border border-brand-800/50" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: c.color || '#3b82f6' }}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-white">{c.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c._count?.products || 0} منتج
                      </p>
                    </div>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white/20 flex-shrink-0"
                    style={{ backgroundColor: c.color || '#3b82f6' }}
                    title="لون الشركة"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-brand-800/30">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${c.isActive ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}
                  >
                    {c.isActive ? 'نشطة' : 'معطلة'}
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg text-brand-400 hover:bg-brand-800/50 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg text-red-400 hover:bg-red-500/15 flex items-center justify-center transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
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
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'تعديل الشركة' : 'إضافة شركة جديدة'}>
        <form onSubmit={handleSave} className="space-y-5">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div
              onClick={() => logoRef.current?.click()}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-brand-700/50 flex items-center justify-center cursor-pointer hover:border-brand-500/50 transition-all overflow-hidden"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              )}
            </div>
            <input type="file" ref={logoRef} accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} className="hidden" />
            <span className="text-xs text-gray-500">اضغط لرفع شعار (اختياري)</span>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">اسم الشركة</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: Honda"
              className="w-full px-3 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm focus:border-brand-500 transition-all"
              required
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">لون الشركة</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm({ ...form, color })}
                  className={`w-8 h-8 rounded-lg transition-all ${form.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-brand-900 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-50">
              {saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إضافة'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white text-sm transition-all">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
