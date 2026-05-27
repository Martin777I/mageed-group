import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/helpers';
import Modal from '../components/Modal';

export default function Returns() {
  const [tab, setTab] = useState('create'); // create | history
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });

  // Create Return state
  const [step, setStep] = useState(1); // 1=search customer, 2=select order, 3=select items, 4=confirm
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState('phone'); // phone | code
  const [customer, setCustomer] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnedMap, setReturnedMap] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultReturn, setResultReturn] = useState(null);

  // Fetch history
  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/returns?search=${search}&page=${page}&limit=20`);
      setReturns(res.data.returns);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب المرتجعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (tab === 'history') fetchReturns(); }, [tab, search, page]);

  // Step 1: Search customer
  const searchCustomer = async () => {
    if (!searchInput.trim()) return;
    setLoading(true);
    try {
      const endpoint = searchType === 'phone'
        ? `/customers/search/phone/${searchInput.trim()}`
        : `/customers/search/code/${searchInput.trim()}`;
      const res = await api.get(endpoint);
      setCustomer(res.data);
      setStep(2);
    } catch {
      toast.error('العميل غير موجود');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Select order → load returned quantities
  const selectOrder = async (order) => {
    setSelectedOrder(order);
    try {
      const res = await api.get(`/returns/order/${order.id}/returned`);
      setReturnedMap(res.data.returned || {});
    } catch {
      setReturnedMap({});
    }
    // Initialize return items
    const items = order.items.map((item) => ({
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      price: item.price,
      purchasedQty: item.quantity,
      alreadyReturned: 0,
      returnQty: 0,
    }));
    setReturnItems(items);
    setStep(3);
  };

  // Update alreadyReturned after loading
  useEffect(() => {
    if (selectedOrder && Object.keys(returnedMap).length >= 0) {
      setReturnItems((prev) =>
        prev.map((item) => ({
          ...item,
          alreadyReturned: returnedMap[item.productId] || 0,
        }))
      );
    }
  }, [returnedMap]);

  const updateReturnQty = (idx, qty) => {
    setReturnItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const maxReturnable = item.purchasedQty - item.alreadyReturned;
        const clamped = Math.min(Math.max(0, parseInt(qty) || 0), maxReturnable);
        return { ...item, returnQty: clamped };
      })
    );
  };

  const setFullReturn = () => {
    setReturnItems((prev) =>
      prev.map((item) => ({
        ...item,
        returnQty: item.purchasedQty - item.alreadyReturned,
      }))
    );
  };

  const totalReturnAmount = returnItems.reduce((sum, i) => sum + i.price * i.returnQty, 0);
  const itemsToReturn = returnItems.filter((i) => i.returnQty > 0);

  const submitReturn = async () => {
    if (itemsToReturn.length === 0) {
      toast.error('يرجى تحديد كميات الإرجاع');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        orderId: selectedOrder.id,
        notes,
        items: itemsToReturn.map((i) => ({
          productId: i.productId,
          quantity: i.returnQty,
        })),
      };

      const res = await api.post('/returns', payload);
      setResultReturn(res.data.return);
      toast.success('تم الإرجاع بنجاح');
      setStep(4);
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors && errors.length > 0) {
        errors.forEach((e) => toast.error(e));
      } else {
        toast.error(err.response?.data?.message || 'خطأ في الإرجاع');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreate = () => {
    setStep(1);
    setSearchInput('');
    setCustomer(null);
    setSelectedOrder(null);
    setReturnItems([]);
    setReturnedMap({});
    setNotes('');
    setResultReturn(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">المرتجعات</h1>
        <p className="text-sm text-gray-400 mt-1">إدارة مرتجعات العملاء واسترجاع المخزون</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-brand-800/30">
        {[
          { key: 'create', label: '+ إرجاع جديد' },
          { key: 'history', label: 'سجل المرتجعات' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'create') resetCreate(); }}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 ${
              tab === t.key ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ======================== CREATE RETURN ======================== */}
      {tab === 'create' && (
        <div className="max-w-4xl space-y-5">

          {/* Steps Indicator */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between">
              {[
                { num: 1, label: 'بحث العميل' },
                { num: 2, label: 'اختيار الفاتورة' },
                { num: 3, label: 'تحديد الكميات' },
                { num: 4, label: 'النتيجة' },
              ].map((s, i) => (
                <div key={s.num} className="flex items-center flex-1">
                  <div className={`flex items-center gap-2 ${step >= s.num ? 'text-brand-400' : 'text-gray-600'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      step > s.num ? 'bg-brand-500 text-white' :
                      step === s.num ? 'bg-brand-500/20 text-brand-400 border border-brand-500/50' :
                      'bg-brand-900/50 text-gray-600 border border-brand-800/30'
                    }`}>
                      {step > s.num ? '✓' : s.num}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                  </div>
                  {i < 3 && <div className={`flex-1 h-px mx-3 ${step > s.num ? 'bg-brand-500/50' : 'bg-brand-800/30'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Search customer */}
          {step === 1 && (
            <div className="glass rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white">بحث عن العميل</h3>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSearchType('phone')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${searchType === 'phone' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-gray-500 border border-brand-800/30 hover:text-gray-300'}`}
                >
                  📱 رقم الهاتف
                </button>
                <button
                  onClick={() => setSearchType('code')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${searchType === 'code' ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30' : 'text-gray-500 border border-brand-800/30 hover:text-gray-300'}`}
                >
                  🏷️ كود العميل
                </button>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCustomer()}
                  placeholder={searchType === 'phone' ? 'أدخل رقم الهاتف...' : 'أدخل كود العميل (CUS-0001)...'}
                  dir="ltr"
                  className="flex-1 px-4 py-3 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white text-sm placeholder-gray-500 focus:border-brand-500 transition-all"
                />
                <button onClick={searchCustomer} disabled={loading} className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-all disabled:opacity-50">
                  {loading ? '...' : 'بحث'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Select order */}
          {step === 2 && customer && (
            <div className="space-y-4">
              {/* Customer info */}
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold">{customer.name.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-white">{customer.name}</p>
                    <p className="text-xs text-gray-500" dir="ltr">{customer.customerCode} — {customer.phone}</p>
                  </div>
                </div>
                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-white transition-colors">تغيير ↻</button>
              </div>

              <div className="glass rounded-2xl p-5">
                <h3 className="text-base font-bold text-white mb-4">اختر الفاتورة / الطلب</h3>
                {customer.orders?.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">لا توجد طلبات مقبولة لهذا العميل</p>
                ) : (
                  <div className="space-y-2">
                    {customer.orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => selectOrder(order)}
                        className="w-full text-right p-4 rounded-xl border border-brand-800/30 hover:border-brand-500/30 hover:bg-brand-500/5 transition-all flex items-center justify-between"
                      >
                        <div>
                          <p className="text-brand-400 font-mono text-sm" dir="ltr">{order.orderNumber}</p>
                          <p className="text-xs text-gray-500 mt-1">{formatDate(order.createdAt)} — {order.items.length} منتج</p>
                        </div>
                        <div className="text-left">
                          <p className="text-accent-400 font-bold">{formatCurrency(order.totalAmount)}</p>
                          {order.returns?.length > 0 && (
                            <p className="text-xs text-orange-400">{order.returns.length} مرتجعات سابقة</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Select items and quantities */}
          {step === 3 && selectedOrder && (
            <div className="space-y-4">
              {/* Order info */}
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{customer.name} — <span className="text-brand-400 font-mono" dir="ltr">{selectedOrder.orderNumber}</span></p>
                  <p className="text-xs text-gray-500">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={setFullReturn} className="px-3 py-1 rounded-lg bg-orange-500/15 text-orange-400 text-xs font-medium border border-orange-500/30 hover:bg-orange-500/25 transition-all">
                    إرجاع كامل
                  </button>
                  <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-white transition-colors">تغيير ↻</button>
                </div>
              </div>

              {/* Items table */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-brand-800/30">
                  <h3 className="text-base font-bold text-white">حدد الكميات المراد إرجاعها</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                        <th className="text-right p-4 font-medium">الكود</th>
                        <th className="text-right p-4 font-medium">المنتج</th>
                        <th className="text-right p-4 font-medium">السعر</th>
                        <th className="text-right p-4 font-medium">مشتراة</th>
                        <th className="text-right p-4 font-medium">مُرجعة</th>
                        <th className="text-right p-4 font-medium">متاح</th>
                        <th className="text-right p-4 font-medium">كمية الإرجاع</th>
                        <th className="text-right p-4 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, idx) => {
                        const maxReturnable = item.purchasedQty - item.alreadyReturned;
                        return (
                          <tr key={idx} className={`border-b border-brand-800/20 ${item.returnQty > 0 ? 'bg-orange-500/5' : ''}`}>
                            <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{item.productCode}</td>
                            <td className="p-4 text-sm text-white">{item.productName}</td>
                            <td className="p-4 text-sm text-gray-400">{formatCurrency(item.price)}</td>
                            <td className="p-4 text-sm text-white font-medium">{item.purchasedQty}</td>
                            <td className="p-4 text-sm text-orange-400">{item.alreadyReturned}</td>
                            <td className="p-4 text-sm">
                              <span className={maxReturnable > 0 ? 'text-green-400' : 'text-red-400'}>{maxReturnable}</span>
                            </td>
                            <td className="p-4">
                              {maxReturnable > 0 ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={maxReturnable}
                                  value={item.returnQty}
                                  onChange={(e) => updateReturnQty(idx, e.target.value)}
                                  className="w-20 px-2 py-1.5 rounded-lg bg-brand-900 border border-brand-800/50 text-white text-sm text-center focus:border-brand-500"
                                  dir="ltr"
                                />
                              ) : (
                                <span className="text-xs text-red-400">تم إرجاع الكل</span>
                              )}
                            </td>
                            <td className="p-4 text-sm text-red-400 font-bold">
                              {item.returnQty > 0 ? formatCurrency(item.price * item.returnQty) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total */}
                {totalReturnAmount > 0 && (
                  <div className="p-4 border-t border-brand-800/30 flex items-center justify-between">
                    <span className="text-gray-400">إجمالي الإرجاع ({itemsToReturn.length} منتج)</span>
                    <span className="text-xl font-bold text-red-400">{formatCurrency(totalReturnAmount)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="glass rounded-xl p-4">
                <label className="block text-sm text-gray-400 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="سبب الإرجاع..."
                  className="w-full px-4 py-2 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm resize-none focus:border-brand-500 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={submitReturn} disabled={submitting || itemsToReturn.length === 0} className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      جاري الإرجاع...
                    </span>
                  ) : `↩ تأكيد الإرجاع (${formatCurrency(totalReturnAmount)})`}
                </button>
                <button onClick={resetCreate} className="px-6 py-3 rounded-xl border border-brand-700/50 text-gray-400 hover:text-white transition-all">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 4 && resultReturn && (
            <div className="glass rounded-2xl p-8 text-center space-y-5">
              <div className="text-6xl">✅</div>
              <h3 className="text-xl font-bold text-white">تم الإرجاع بنجاح</h3>
              <p className="text-brand-400 font-mono text-lg" dir="ltr">{resultReturn.returnNumber}</p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                <div className="bg-brand-900/50 rounded-xl p-3">
                  <p className="text-lg font-bold text-orange-400">{resultReturn.items?.length || 0}</p>
                  <p className="text-xs text-gray-500">منتج</p>
                </div>
                <div className="bg-brand-900/50 rounded-xl p-3">
                  <p className="text-lg font-bold text-red-400">{formatCurrency(resultReturn.totalAmount)}</p>
                  <p className="text-xs text-gray-500">إجمالي</p>
                </div>
                <div className="bg-brand-900/50 rounded-xl p-3">
                  <p className="text-lg font-bold text-green-400">✓</p>
                  <p className="text-xs text-gray-500">المخزون مُحدث</p>
                </div>
              </div>
              <button onClick={resetCreate} className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all">
                إرجاع جديد
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================== HISTORY TAB ======================== */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث برقم المرتجع أو اسم العميل..."
              className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
            />
          </div>

          {loading ? (
            <LoadingSpinner text="جاري تحميل المرتجعات..." />
          ) : returns.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">↩️</div>
              <p className="text-gray-400 text-lg">لا توجد مرتجعات</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                      <th className="text-right p-4 font-medium">رقم المرتجع</th>
                      <th className="text-right p-4 font-medium">العميل</th>
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
                        <td className="p-4 text-sm text-white">
                          <div>{r.customer?.name}</div>
                          <div className="text-xs text-gray-500 font-mono" dir="ltr">{r.customer?.customerCode}</div>
                        </td>
                        <td className="p-4 text-sm text-brand-400 font-mono" dir="ltr">{r.order?.orderNumber}</td>
                        <td className="p-4 text-sm text-gray-400">
                          {r.items?.map((item) => (
                            <div key={item.id} className="text-xs">{item.product?.name} × {item.quantity}</div>
                          ))}
                        </td>
                        <td className="p-4 text-sm text-red-400 font-bold">{formatCurrency(r.totalAmount)}</td>
                        <td className="p-4 text-sm text-gray-500">{formatDate(r.createdAt)}</td>
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
      )}
    </div>
  );
}
