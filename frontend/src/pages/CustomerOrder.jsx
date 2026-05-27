import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function CustomerOrder() {
  const navigate = useNavigate();
  const codeInputRef = useRef(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const lookupProduct = async () => {
    const code = productCode.trim();
    if (!code) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await api.get(`/products/code/${code}`);
      setLookupResult(res.data);
    } catch {
      setLookupResult(null);
      toast.error('المنتج غير موجود');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupProduct();
    }
  };

  const addToCart = () => {
    if (!lookupResult) return;
    const existing = cart.find((c) => c.code === lookupResult.code);
    if (existing) {
      setCart(cart.map((c) => c.code === lookupResult.code ? { ...c, quantity: c.quantity + quantity } : c));
    } else {
      setCart([...cart, {
        code: lookupResult.code,
        name: lookupResult.name,
        price: lookupResult.price,
        quantity,
      }]);
    }
    setProductCode('');
    setQuantity(1);
    setLookupResult(null);
    codeInputRef.current?.focus();
  };

  const removeFromCart = (code) => {
    setCart(cart.filter((c) => c.code !== code));
  };

  const updateQty = (code, newQty) => {
    if (newQty < 1) return;
    setCart(cart.map((c) => c.code === code ? { ...c, quantity: newQty } : c));
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const validate = () => {
    const e = {};
    if (!customerName.trim()) e.name = 'الاسم مطلوب';
    if (!customerPhone.trim()) e.phone = 'رقم الهاتف مطلوب';
    else if (!/^[0-9+\-\s()]{8,20}$/.test(customerPhone)) e.phone = 'رقم هاتف غير صالح';
    if (cart.length === 0) e.cart = 'أضف منتج واحد على الأقل';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitOrder = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/orders`, {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cart.map((c) => ({ code: c.code, quantity: c.quantity })),
      });
      navigate(`/order-success/${res.data.orderNumber}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 via-brand-900 to-[#0a0f1e]">
      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/20 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 pt-8 pb-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-brand-500/30">
            M
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">مجموعة ماجد</h1>
          <p className="text-brand-400 text-sm">قطع غيار الموتوسيكلات والتوك توك</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pb-8 space-y-5">
        {/* Customer Info */}
        <section className="glass rounded-2xl p-5 animate-fade-in">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            بيانات العميل
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">الاسم</label>
              <input
                id="customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أدخل اسمك"
                className={`w-full px-4 py-2.5 rounded-xl bg-brand-900/80 border text-white placeholder-gray-500 text-sm transition-all ${errors.name ? 'border-red-500' : 'border-brand-800/50 focus:border-brand-500'}`}
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">رقم الهاتف</label>
              <input
                id="customer-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className={`w-full px-4 py-2.5 rounded-xl bg-brand-900/80 border text-white placeholder-gray-500 text-sm transition-all ${errors.phone ? 'border-red-500' : 'border-brand-800/50 focus:border-brand-500'}`}
                dir="ltr"
              />
              {errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}
            </div>
          </div>
        </section>

        {/* Product Entry */}
        <section className="glass rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            إضافة منتج
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                ref={codeInputRef}
                id="product-code"
                type="text"
                value={productCode}
                onChange={(e) => { setProductCode(e.target.value); setLookupResult(null); }}
                onKeyDown={handleCodeKeyDown}
                placeholder="أدخل كود المنتج"
                className="w-full px-4 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
                dir="ltr"
              />
            </div>
            <button
              onClick={lookupProduct}
              disabled={lookupLoading || !productCode.trim()}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {lookupLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  بحث...
                </span>
              ) : 'بحث'}
            </button>
          </div>

          {/* Lookup Result */}
          {lookupResult && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{lookupResult.name}</p>
                  <p className="text-sm text-gray-400">الكود: <span dir="ltr" className="text-brand-400">{lookupResult.code}</span></p>
                  <p className="text-sm text-accent-400 font-bold mt-1">{lookupResult.price.toFixed(2)} ج.م</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 rounded-lg bg-brand-800 text-white hover:bg-brand-700 transition-colors flex items-center justify-center">−</button>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center py-1.5 rounded-lg bg-brand-900 border border-brand-800/50 text-white text-sm"
                      dir="ltr"
                    />
                    <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 rounded-lg bg-brand-800 text-white hover:bg-brand-700 transition-colors flex items-center justify-center">+</button>
                  </div>
                  <button
                    onClick={addToCart}
                    className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all"
                  >
                    أضف
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Cart */}
        {cart.length > 0 && (
          <section className="glass rounded-2xl p-5 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-base font-bold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg>
                سلة الطلب ({cart.length})
              </span>
            </h2>
            {errors.cart && <p className="text-xs text-red-400 mb-3">{errors.cart}</p>}

            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.code} className="flex items-center justify-between p-3 rounded-xl bg-brand-900/60 border border-brand-800/30">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-gray-400" dir="ltr">{item.code}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.code, item.quantity - 1)} className="w-7 h-7 rounded bg-brand-800 text-white text-sm hover:bg-brand-700 transition-colors flex items-center justify-center">−</button>
                      <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                      <button onClick={() => updateQty(item.code, item.quantity + 1)} className="w-7 h-7 rounded bg-brand-800 text-white text-sm hover:bg-brand-700 transition-colors flex items-center justify-center">+</button>
                    </div>
                    <span className="text-accent-400 font-bold text-sm min-w-[80px] text-left" dir="ltr">{(item.price * item.quantity).toFixed(2)}</span>
                    <button onClick={() => removeFromCart(item.code)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Total & Submit */}
            <div className="mt-5 pt-4 border-t border-brand-800/30">
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold text-white">الإجمالي</span>
                <span className="text-xl font-bold text-accent-400" dir="ltr">{total.toFixed(2)} ج.م</span>
              </div>
              <button
                id="submit-order"
                onClick={submitOrder}
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الإرسال...
                  </span>
                ) : 'إرسال الطلب'}
              </button>
            </div>
          </section>
        )}

        {/* Admin Link */}
        <div className="text-center pt-4">
          <a href="/login" className="text-xs text-gray-600 hover:text-brand-400 transition-colors">
            دخول لوحة الإدارة
          </a>
        </div>
      </div>
    </div>
  );
}
