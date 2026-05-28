import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, statusMap } from '../utils/helpers';
import { openInvoice } from '../utils/invoiceGenerator';
import LoadingSpinner from '../components/LoadingSpinner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const FALLBACK_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [lookingUp, setLookingUp] = useState(false);
  const [notes, setNotes] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [returnedMap, setReturnedMap] = useState({});

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
      setItems(res.data.items.map((i) => ({
        productCode: i.productCode, productName: i.productName, price: i.price,
        quantity: i.quantity, total: i.total, productId: i.productId,
      })));
      setNotes(res.data.notes || '');
    } catch {
      toast.error('الطلب غير موجود');
      navigate('/admin/orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await api.get(`/orders/${id}/analytics`);
      setAnalytics(res.data);
    } catch { /* silent */ }
  };

  const fetchReturned = async () => {
    try {
      const res = await api.get(`/returns/order/${id}/returned`);
      setReturnedMap(res.data.returned || {});
    } catch { /* silent */ }
  };

  useEffect(() => { fetchOrder(); fetchAnalytics(); fetchReturned(); }, [id]);

  const updateItemQty = (idx, qty) => { if (qty < 1) return; setItems(items.map((item, i) => i === idx ? { ...item, quantity: qty, total: item.price * qty } : item)); };
  const removeItem = (idx) => { if (items.length <= 1) { toast.error('يجب أن يحتوي الطلب على منتج واحد على الأقل'); return; } setItems(items.filter((_, i) => i !== idx)); };

  const addItem = async () => {
    if (!newCode.trim()) return;
    setLookingUp(true);
    try {
      const res = await api.get(`/products/code/${newCode.trim()}`);
      const p = res.data;
      const existing = items.findIndex((i) => i.productCode === p.code);
      if (existing >= 0) {
        setItems(items.map((item, i) => i === existing ? { ...item, quantity: item.quantity + newQty, total: item.price * (item.quantity + newQty) } : item));
      } else {
        setItems([...items, { productCode: p.code, productName: p.name, price: p.price, quantity: newQty, total: p.price * newQty, productId: p.id }]);
      }
      setNewCode(''); setNewQty(1);
    } catch { toast.error('المنتج غير موجود'); } finally { setLookingUp(false); }
  };

  const saveItems = async () => {
    setSaving(true);
    try {
      await api.put(`/orders/${id}/items`, { items });
      toast.success('تم تحديث عناصر الطلب');
      setEditing(false); fetchOrder(); fetchAnalytics(); fetchReturned();
    } catch (err) { toast.error(err.response?.data?.message || 'خطأ في التحديث'); } finally { setSaving(false); }
  };

  const updateStatus = async (status) => {
    const confirmMsg = status === 'accepted' ? 'هل أنت متأكد من قبول الطلب؟ سيتم خصم المخزون تلقائياً.' : 'هل أنت متأكد من رفض الطلب؟';
    if (!confirm(confirmMsg)) return;
    setSaving(true);
    try {
      await api.put(`/orders/${id}/status`, { status, notes });
      toast.success(status === 'accepted' ? 'تم قبول الطلب وخصم المخزون' : 'تم رفض الطلب');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في تحديث الحالة');
    } finally { setSaving(false); }
  };

  const downloadPdf = () => {
    try {
      openInvoice(order);
    } catch (err) {
      if (err.message === 'popup_blocked') {
        toast.error('يرجى السماح بالنوافذ المنبثقة لعرض الفاتورة');
      } else {
        toast.error('خطأ في تحميل الفاتورة');
      }
    }
  };

  const sendWhatsApp = () => {
    // Clean phone number: keep digits only, ensure country code
    let phone = order.customerPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '2' + phone; // Egypt: 0xxx → 20xxx
    if (!phone.startsWith('2')) phone = '2' + phone;

    // Build invoice link — uses frontend domain (not backend)
    const invoiceLink = `${window.location.origin}/invoice/${order.orderNumber}`;

    // Build invoice message with link
    const fmtPrice = (v) => Number(v || 0).toFixed(2);
    const date = new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

    let msg = `✅ *فاتورة طلب — MAGED GROUP*\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `📋 رقم الطلب: *${order.orderNumber}*\n`;
    msg += `📅 التاريخ: ${date}\n`;
    msg += `👤 العميل: ${order.customerName}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `📦 *المنتجات:*\n\n`;

    items.forEach((item, i) => {
      msg += `${i + 1}. ${item.productName}\n`;
      msg += `   الكود: ${item.productCode}\n`;
      msg += `   الكمية: ${item.quantity} × ${fmtPrice(item.price)} = *${fmtPrice(item.total)} EGP*\n\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *الإجمالي: ${fmtPrice(order.totalAmount)} EGP*\n`;
    if (order.notes) msg += `📝 ملاحظات: ${order.notes}\n`;
    msg += `━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `📄 *لعرض الفاتورة كاملة:*\n${invoiceLink}\n\n`;
    msg += `شكراً لتعاملكم مع *MAGED GROUP* 🏍️`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  if (loading) return <LoadingSpinner text="جاري تحميل الطلب..." />;
  if (!order) return null;

  const st = statusMap[order.status] || statusMap.pending;
  const total = editing ? items.reduce((s, i) => s + i.total, 0) : order.totalAmount;

  const chartData = analytics?.analytics?.map((a, i) => ({
    name: a.companyName, value: a.totalPrice, color: a.companyColor || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    percentage: a.percentage, quantity: a.totalQuantity, itemCount: a.itemCount,
  })) || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.[0]) {
      const d = payload[0].payload;
      return (
        <div className="bg-brand-900/95 backdrop-blur border border-brand-800/50 rounded-xl p-3 shadow-xl" dir="rtl">
          <p className="font-bold text-white text-sm mb-1">{d.name}</p>
          <p className="text-xs text-gray-400">الإجمالي: <span className="text-accent-400 font-bold">{formatCurrency(d.value)}</span></p>
          <p className="text-xs text-gray-400">النسبة: <span className="text-brand-400">{d.percentage}%</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/orders')} className="w-10 h-10 rounded-xl border border-brand-800/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-brand-800/50 transition-all">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">طلب <span className="text-brand-400" dir="ltr">{order.orderNumber}</span></h1>
            <p className="text-sm text-gray-400">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {order.stockDeducted && <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">📦 تم خصم المخزون</span>}
          <span className={`px-4 py-1.5 rounded-full text-sm font-medium border ${st.color}`}>{st.label}</span>
        </div>
      </div>

      {/* Customer Info */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">بيانات العميل</h2>
          {order.customer && (
            <Link to={`/admin/customers/${order.customer.id}`} className="text-sm text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
              عرض الملف الشخصي ←
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">الاسم</p>
            <p className="text-white">{order.customerName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">الهاتف</p>
            <p className="text-white" dir="ltr">{order.customerPhone}</p>
          </div>
          {order.customer && (
            <>
              <div>
                <p className="text-sm text-gray-400">كود العميل</p>
                <p className="text-brand-400 font-mono" dir="ltr">{order.customer.customerCode}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">العنوان</p>
                <p className="text-white">{order.customer.address || '—'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">عناصر الطلب</h2>
          {order.status === 'pending' && !editing && <button onClick={() => setEditing(true)} className="text-sm text-brand-400 hover:text-brand-300">تعديل</button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                <th className="text-right pb-3 font-medium">الكود</th>
                <th className="text-right pb-3 font-medium">المنتج</th>
                <th className="text-right pb-3 font-medium">السعر</th>
                <th className="text-right pb-3 font-medium">الكمية</th>
                <th className="text-right pb-3 font-medium">مُرجع</th>
                <th className="text-right pb-3 font-medium">فعلي</th>
                <th className="text-right pb-3 font-medium">الإجمالي</th>
                {editing && <th className="text-right pb-3 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const returned = returnedMap[item.productId] || 0;
                const effective = item.quantity - returned;
                return (
                  <tr key={idx} className="border-b border-brand-800/20">
                    <td className="py-3 text-sm text-brand-400 font-mono" dir="ltr">{item.productCode}</td>
                    <td className="py-3 text-sm text-white">{item.productName}</td>
                    <td className="py-3 text-sm text-gray-400">{formatCurrency(item.price)}</td>
                    <td className="py-3 text-sm">
                      {editing ? (
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 1)} className="w-16 px-2 py-1 rounded bg-brand-900 border border-brand-800/50 text-white text-sm text-center" dir="ltr" />
                      ) : <span className="text-white">{item.quantity}</span>}
                    </td>
                    <td className="py-3 text-sm text-orange-400">{returned > 0 ? returned : '—'}</td>
                    <td className="py-3 text-sm text-green-400 font-medium">{effective}</td>
                    <td className="py-3 text-sm text-accent-400 font-bold">{formatCurrency(item.total)}</td>
                    {editing && (
                      <td className="py-3">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-300"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {editing && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-xl bg-brand-900/60 border border-brand-800/30">
            <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="كود المنتج" dir="ltr" className="flex-1 px-3 py-2 rounded-lg bg-brand-900 border border-brand-800/50 text-white text-sm" />
            <input type="number" min="1" value={newQty} onChange={(e) => setNewQty(parseInt(e.target.value) || 1)} className="w-20 px-3 py-2 rounded-lg bg-brand-900 border border-brand-800/50 text-white text-sm text-center" dir="ltr" />
            <button onClick={addItem} disabled={lookingUp} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm">{lookingUp ? '...' : 'إضافة'}</button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-brand-800/30 flex items-center justify-between">
          <span className="text-lg font-bold text-white">الإجمالي</span>
          <span className="text-xl font-bold text-accent-400">{formatCurrency(total)}</span>
        </div>

        {editing && (
          <div className="mt-4 flex gap-3">
            <button onClick={saveItems} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-medium text-sm disabled:opacity-50">{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
            <button onClick={() => { setEditing(false); fetchOrder(); }} className="px-6 py-2.5 rounded-xl border border-brand-700/50 text-gray-400 text-sm">إلغاء</button>
          </div>
        )}
      </div>

      {/* Returns History */}
      {order.returns?.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-400">↩</span>
            المرتجعات ({order.returns.length})
          </h2>
          <div className="space-y-3">
            {order.returns.map((ret) => (
              <div key={ret.id} className="bg-brand-900/50 rounded-xl p-4 border border-brand-800/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-orange-400 font-mono text-sm" dir="ltr">{ret.returnNumber}</span>
                  <span className="text-sm text-gray-500">{formatDate(ret.createdAt)}</span>
                </div>
                <div className="space-y-1">
                  {ret.items?.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{item.product?.name || item.product?.code} × {item.quantity}</span>
                      <span className="text-red-400">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-brand-800/20 flex items-center justify-between">
                  <span className="text-xs text-gray-500">إجمالي المرتجع</span>
                  <span className="text-sm font-bold text-red-400">{formatCurrency(ret.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Pie Chart */}
      {chartData.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-5 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">📊</span>
            تحليلات حسب الشركة
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex items-center justify-center" style={{ height: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} cx="50%" cy="50%" outerRadius={110} innerRadius={45} dataKey="value" stroke="rgba(15,23,42,0.8)" strokeWidth={3} animationDuration={800}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {chartData.map((e, i) => (
                <div key={i} className="bg-brand-900/50 rounded-xl p-3 border border-brand-800/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                      <span className="font-bold text-white text-sm">{e.name}</span>
                    </div>
                    <span className="text-brand-400 font-bold text-sm">{e.percentage}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-brand-800/50 mb-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${e.percentage}%`, backgroundColor: e.color }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-500">المنتجات</span><p className="text-white">{e.itemCount}</p></div>
                    <div><span className="text-gray-500">الكمية</span><p className="text-white">{e.quantity}</p></div>
                    <div><span className="text-gray-500">الإجمالي</span><p className="text-accent-400 font-bold">{formatCurrency(e.value)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {order.status === 'pending' && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-3">ملاحظات</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="أضف ملاحظات..." className="w-full px-4 py-3 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm resize-none focus:border-brand-500" />
        </div>
      )}
      {order.notes && order.status !== 'pending' && (
        <div className="glass rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-2">ملاحظات</h2>
          <p className="text-sm text-gray-400">{order.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {order.status === 'pending' && (
          <>
            <button onClick={() => updateStatus('accepted')} disabled={saving} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50 shadow-lg shadow-green-500/20">✓ قبول الطلب</button>
            <button onClick={() => updateStatus('rejected')} disabled={saving} className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50">✕ رفض الطلب</button>
          </>
        )}
        {order.status === 'accepted' && (
          <>
            <button onClick={downloadPdf} className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium shadow-lg shadow-brand-500/20">📄 تحميل الفاتورة</button>
            <button onClick={sendWhatsApp} className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium shadow-lg shadow-green-500/20 flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              إرسال على واتساب
            </button>
            <Link to="/admin/returns" className="px-6 py-3 rounded-xl border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 font-medium transition-all">↩ إرجاع منتجات</Link>
          </>
        )}
      </div>
    </div>
  );
}
