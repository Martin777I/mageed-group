import { useState, useRef, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/helpers';

const MODES = [
  { value: 'CREATE_ONLY', label: 'إنشاء فقط', desc: 'إنشاء المنتجات الجديدة فقط — تخطي الموجود', icon: '➕', border: 'border-green-500/30', bg: 'bg-green-500/10' },
  { value: 'UPDATE_ONLY', label: 'تحديث فقط', desc: 'تحديث المنتجات الموجودة فقط — تخطي الجديد', icon: '🔄', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  { value: 'CREATE_UPDATE', label: 'إنشاء + تحديث', desc: 'إنشاء الجديد وتحديث الموجود', icon: '⚡', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  { value: 'VALIDATE_ONLY', label: 'معاينة فقط', desc: 'التحقق من الملف بدون أي تعديل', icon: '🔍', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10' },
];

const STOCK_BEHAVIORS = [
  { value: 'REPLACE', label: 'استبدال المخزون', desc: 'القيمة في الملف تحل محل المخزون الحالي', icon: '🔁', example: 'حالي 10 → ملف 15 → النتيجة 15' },
  { value: 'ADD', label: 'إضافة للمخزون', desc: 'القيمة في الملف تُضاف إلى المخزون الحالي', icon: '➕', example: 'حالي 10 → ملف 15 → النتيجة 25' },
  { value: 'SUBTRACT', label: 'خصم من المخزون', desc: 'القيمة في الملف تُخصم من المخزون الحالي', icon: '➖', example: 'حالي 20 → ملف 5 → النتيجة 15' },
];

const actionColors = {
  CREATE: 'bg-green-500/20 text-green-400 border-green-500/30',
  UPDATE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SKIP: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const actionLabels = { CREATE: 'إنشاء', UPDATE: 'تحديث', SKIP: 'تخطي', ERROR: 'خطأ' };

export default function ImportProducts() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('CREATE_UPDATE');
  const [stockBehavior, setStockBehavior] = useState('REPLACE');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!droppedFile) return;
    const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (!validTypes.includes(droppedFile.type) && !droppedFile.name.match(/\.xlsx?$/i)) {
      toast.error('يُسمح فقط بملفات Excel (.xlsx)');
      return;
    }
    if (droppedFile.size > 5 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن لا يتجاوز 5 ميجابايت');
      return;
    }
    setFile(droppedFile);
    setStep(2);
  }, []);

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('stockBehavior', stockBehavior);
      const res = await api.post('/products/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data);
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في معاينة الملف');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('stockBehavior', stockBehavior);
      const res = await api.post('/products/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      setStep(4);
      toast.success('تم الاستيراد بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1); setFile(null); setMode('CREATE_UPDATE'); setStockBehavior('REPLACE');
    setPreview(null); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">استيراد المنتجات</h1>
          <p className="text-sm text-gray-400 mt-1">استيراد المنتجات من ملف Excel بشكل احترافي</p>
        </div>
        {step > 1 && (
          <button onClick={reset} className="px-4 py-2 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white text-sm transition-all">↻ استيراد جديد</button>
        )}
      </div>

      {/* Steps */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          {[{ num: 1, label: 'رفع الملف' }, { num: 2, label: 'الإعدادات' }, { num: 3, label: 'المعاينة' }, { num: 4, label: 'النتائج' }].map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${step >= s.num ? 'text-brand-400' : 'text-gray-600'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step > s.num ? 'bg-brand-500 text-white' : step === s.num ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' : 'bg-brand-900/50 text-gray-600 border border-brand-800/30'}`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < 3 && <div className={`flex-1 h-px mx-3 ${step > s.num ? 'bg-brand-500/50' : 'bg-brand-800/30'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className={`glass rounded-2xl p-12 text-center transition-all cursor-pointer ${dragOver ? 'border-brand-500/60 bg-brand-500/5 scale-[1.01]' : 'hover:border-brand-500/30'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleFileDrop} className="hidden" />
          <div className="text-6xl mb-4">{dragOver ? '📂' : '📥'}</div>
          <h3 className="text-lg font-bold text-white mb-2">اسحب ملف Excel هنا أو اضغط للاختيار</h3>
          <p className="text-sm text-gray-400 mb-4">يدعم ملفات .xlsx — الحد الأقصى 5 ميجابايت</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-900/80 border border-brand-800/30 text-xs text-gray-500">
            <span>الأعمدة:</span>
            <span className="text-brand-400">code, name, price, retailPrice, stock, category, company</span>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-brand-800/30">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center text-brand-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div>
                <p className="text-white font-medium">{file?.name}</p>
                <p className="text-xs text-gray-500">{(file?.size / 1024).toFixed(1)} كيلوبايت</p>
              </div>
            </div>

            {/* Import Mode */}
            <h3 className="text-base font-bold text-white mb-3">أ) وضع الاستيراد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {MODES.map((m) => (
                <button key={m.value} onClick={() => setMode(m.value)}
                  className={`relative p-4 rounded-xl border text-right transition-all ${mode === m.value ? `${m.border} ${m.bg} ring-1 ring-current` : 'border-brand-800/30 hover:border-brand-700/50 bg-brand-900/30'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="font-bold text-white text-sm">{m.label}</p>
                      <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
                    </div>
                  </div>
                  {mode === m.value && (
                    <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Stock Behavior */}
            {mode !== 'VALIDATE_ONLY' && (
              <>
                <h3 className="text-base font-bold text-white mb-3">ب) سلوك المخزون</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STOCK_BEHAVIORS.map((sb) => (
                    <button key={sb.value} onClick={() => setStockBehavior(sb.value)}
                      className={`relative p-4 rounded-xl border text-right transition-all ${stockBehavior === sb.value ? 'border-cyan-500/30 bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'border-brand-800/30 hover:border-brand-700/50 bg-brand-900/30'}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{sb.icon}</span>
                        <div>
                          <p className="font-bold text-white text-sm">{sb.label}</p>
                          <p className="text-xs text-gray-400 mt-1">{sb.desc}</p>
                          <p className="text-xs text-cyan-400/70 mt-1 font-mono" dir="ltr">{sb.example}</p>
                        </div>
                      </div>
                      {stockBehavior === sb.value && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={handlePreview} disabled={loading} className="flex-1 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-brand-500/20">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري المعاينة...</span> : '🔍 معاينة الملف'}
            </button>
            <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white transition-all">رجوع</button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass rounded-xl p-4 text-center"><p className="text-2xl font-bold text-white">{preview.totalRows}</p><p className="text-xs text-gray-400 mt-1">إجمالي الصفوف</p></div>
            <div className="glass rounded-xl p-4 text-center"><p className="text-2xl font-bold text-green-400">{preview.preview?.filter(p => p.action === 'CREATE').length || 0}</p><p className="text-xs text-gray-400 mt-1">سيتم إنشاؤها</p></div>
            <div className="glass rounded-xl p-4 text-center"><p className="text-2xl font-bold text-blue-400">{preview.preview?.filter(p => p.action === 'UPDATE').length || 0}</p><p className="text-xs text-gray-400 mt-1">سيتم تحديثها</p></div>
            <div className="glass rounded-xl p-4 text-center"><p className="text-2xl font-bold text-yellow-400">{preview.preview?.filter(p => p.action === 'SKIP').length || 0}</p><p className="text-xs text-gray-400 mt-1">سيتم تخطيها</p></div>
          </div>

          {preview.duplicatesInFile?.length > 0 && (
            <div className="glass rounded-xl p-4 border-yellow-500/30">
              <h4 className="text-sm font-bold text-yellow-400 mb-2">⚠️ أكواد مكررة داخل الملف</h4>
              {preview.duplicatesInFile.map((dup, i) => (
                <p key={i} className="text-xs text-gray-400">الكود <span className="text-yellow-400 font-mono">{dup.code}</span> مكرر في الصفوف: {dup.rows.join('، ')}</p>
              ))}
            </div>
          )}

          {preview.validationErrors?.length > 0 && (
            <div className="glass rounded-xl p-4 border-red-500/30">
              <h4 className="text-sm font-bold text-red-400 mb-3">❌ أخطاء التحقق ({preview.validationErrors.length})</h4>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-500 text-xs"><th className="text-right pb-2">الصف</th><th className="text-right pb-2">الحقل</th><th className="text-right pb-2">الخطأ</th></tr></thead>
                  <tbody>{preview.validationErrors.map((err, i) => (
                    <tr key={i} className="border-t border-brand-800/20"><td className="py-2 text-red-400 font-mono">{err.rowNumber}</td><td className="py-2 text-gray-400">{err.field}</td><td className="py-2 text-gray-300">{err.error}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {preview.preview?.length > 0 && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-brand-800/30">
                <h4 className="text-sm font-bold text-white">معاينة العمليات ({preview.preview.length} منتج)</h4>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-brand-900/95 backdrop-blur">
                    <tr className="text-gray-400 text-xs border-b border-brand-800/30">
                      <th className="text-right p-3">الكود</th>
                      <th className="text-right p-3">الاسم</th>
                      <th className="text-right p-3">سعر الجملة</th>
                      <th className="text-right p-3">سعر القطاعي</th>
                      <th className="text-right p-3">مخزون حالي</th>
                      <th className="text-right p-3">مخزون الملف</th>
                      <th className="text-right p-3">المخزون الناتج</th>
                      <th className="text-right p-3">العملية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="border-b border-brand-800/20 table-row-hover">
                        <td className="p-3 text-brand-400 font-mono" dir="ltr">{row.code}</td>
                        <td className="p-3 text-white">{row.name}</td>
                        <td className="p-3 text-gray-400" dir="ltr">{row.price || '—'}</td>
                        <td className="p-3 text-gray-400" dir="ltr">{row.retailPrice || '—'}</td>
                        <td className="p-3 text-gray-500" dir="ltr">{row.oldStock}</td>
                        <td className="p-3 text-cyan-400" dir="ltr">{row.importedStock}</td>
                        <td className="p-3 text-white font-bold" dir="ltr">
                          {row.action === 'SKIP' ? '—' : row.resultingStock}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${actionColors[row.action]}`}>{actionLabels[row.action]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {mode !== 'VALIDATE_ONLY' && (
              <button onClick={handleImport} disabled={loading || preview.validRows === 0} className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-green-500/20">
                {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />جاري الاستيراد...</span> : `✓ تنفيذ الاستيراد (${preview.validRows} منتج)`}
              </button>
            )}
            <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white transition-all">رجوع</button>
          </div>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 4 && result && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'إجمالي', value: result.totalRows, color: 'text-white', icon: '📊' },
              { label: 'إنشاء', value: result.created, color: 'text-green-400', icon: '✅' },
              { label: 'تحديث', value: result.updated, color: 'text-blue-400', icon: '🔄' },
              { label: 'تخطي', value: result.skipped, color: 'text-yellow-400', icon: '⏭️' },
              { label: 'أخطاء', value: result.validationErrors?.length || 0, color: 'text-red-400', icon: '❌' },
              { label: 'مكررات', value: result.duplicatesInFile?.length || 0, color: 'text-orange-400', icon: '⚠️' },
            ].map((c, i) => (
              <div key={i} className="glass rounded-xl p-4 text-center">
                <div className="text-2xl mb-2">{c.icon}</div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {result.warnings?.length > 0 && (
            <div className="glass rounded-xl p-4">
              <h4 className="text-sm font-bold text-yellow-400 mb-3">⚠️ التحذيرات ({result.warnings.length})</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.warnings.map((w, i) => <p key={i} className="text-xs text-gray-400"><span className="text-yellow-400/70 font-mono">صف {w.rowNumber}:</span> {w.message}</p>)}
              </div>
            </div>
          )}

          <button onClick={reset} className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all shadow-lg shadow-brand-500/20">📥 استيراد ملف جديد</button>
        </div>
      )}
    </div>
  );
}
