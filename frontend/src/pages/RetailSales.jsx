import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../utils/helpers';

export default function RetailSales() {
  const [tab, setTab] = useState('create'); // create | history
  const codeInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // ─── Create Invoice State ───
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productCode, setProductCode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resultInvoice, setResultInvoice] = useState(null);

  // ─── Smart Search State ───
  const [searchMode, setSearchMode] = useState('name'); // 'name' | 'code'
  const [nameQuery, setNameQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchTimerRef = useRef(null);

  // ─── History State ───
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ pages: 1 });

  // ─── Stats ───
  const [stats, setStats] = useState(null);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/retail/stats');
        setStats(res.data);
      } catch { /* silent */ }
    };
    fetchStats();
  }, [resultInvoice]);

  // Fetch history
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/retail?search=${search}&page=${page}&limit=20`);
      setInvoices(res.data.invoices);
      setPagination(res.data.pagination);
    } catch {
      toast.error('خطأ في جلب الفواتير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (tab === 'history') fetchInvoices(); }, [tab, search, page]);

  // ─── Close dropdown when clicking outside ───
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Debounced Name Search ───
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get(`/products/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(res.data);
      setShowDropdown(res.data.length > 0);
      setHighlightedIndex(-1);
    } catch {
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleNameQueryChange = (value) => {
    setNameQuery(value);
    setLookupResult(null);
    // Debounce
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length >= 1) {
      setSearchLoading(true);
      searchTimerRef.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    } else {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchLoading(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const selectSearchResult = (product) => {
    setLookupResult(product);
    setNameQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setHighlightedIndex(-1);
  };

  const handleSearchKeyDown = (e) => {
    if (!showDropdown || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        selectSearchResult(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // ─── Product Lookup by Code ───
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
        companyName: lookupResult.company?.name || null,
        price: lookupResult.price,
        stock: lookupResult.stock,
        quantity,
      }]);
    }
    setProductCode('');
    setNameQuery('');
    setQuantity(1);
    setLookupResult(null);
    if (searchMode === 'code') {
      codeInputRef.current?.focus();
    } else {
      nameInputRef.current?.focus();
    }
  };

  const removeFromCart = (code) => setCart(cart.filter((c) => c.code !== code));
  const updateQty = (code, newQty) => {
    if (newQty < 1) return;
    setCart(cart.map((c) => c.code === code ? { ...c, quantity: newQty } : c));
  };

  const total = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const submitInvoice = async () => {
    if (cart.length === 0) {
      toast.error('أضف منتج واحد على الأقل');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/retail', {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart.map((c) => ({ code: c.code, quantity: c.quantity })),
        notes: notes.trim() || undefined,
      });
      setResultInvoice(res.data.invoice);
      toast.success('تم إنشاء الفاتورة بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreate = () => {
    setCustomerName('');
    setCustomerPhone('');
    setProductCode('');
    setNameQuery('');
    setQuantity(1);
    setCart([]);
    setLookupResult(null);
    setNotes('');
    setResultInvoice(null);
    setSearchResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">البيع القطاعي</h1>
          <p className="text-sm text-gray-400 mt-1">إنشاء فواتير البيع القطاعي وإدارة المبيعات</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">فواتير اليوم</p>
            <p className="text-xl font-bold text-brand-400">{stats.todayInvoices}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">إيرادات اليوم</p>
            <p className="text-xl font-bold text-accent-400">{formatCurrency(stats.todayRevenue)}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">إجمالي الفواتير</p>
            <p className="text-xl font-bold text-white">{stats.totalInvoices}</p>
          </div>
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">مبيعات الشهر</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(stats.monthlySales?.amount || 0)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-brand-800/30">
        {[
          { key: 'create', label: '+ فاتورة جديدة' },
          { key: 'history', label: 'سجل الفواتير' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'create') resetCreate(); }}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 ${tab === t.key ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ======================== CREATE INVOICE ======================== */}
      {tab === 'create' && !resultInvoice && (
        <div className="max-w-4xl space-y-5">
          {/* Customer Info (Optional) */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                بيانات العميل
              </h3>
              <span className="text-xs text-gray-500 bg-brand-800/30 px-2 py-1 rounded-lg">اختياري</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">الاسم</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="اسم العميل (اختياري)"
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">رقم الهاتف</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="رقم الهاتف (اختياري)"
                  className="w-full px-4 py-2.5 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Product Entry */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                إضافة منتج
              </h3>
              {/* Search Mode Toggle */}
              <div className="flex items-center gap-1 bg-brand-900/60 rounded-xl p-1">
                <button
                  onClick={() => { setSearchMode('name'); setLookupResult(null); setProductCode(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'name'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                  🔍 بحث بالاسم
                </button>
                <button
                  onClick={() => { setSearchMode('code'); setLookupResult(null); setNameQuery(''); setSearchResults([]); setShowDropdown(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${searchMode === 'code'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-gray-400 hover:text-gray-300'
                    }`}
                >
                  # بحث بالكود
                </button>
              </div>
            </div>

            {/* ─── Search by Name Mode ─── */}
            {searchMode === 'name' && (
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={nameQuery}
                    onChange={(e) => handleNameQueryChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                    placeholder="ابحث باسم المنتج أو الكود..."
                    className="w-full px-4 py-3 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all pr-12"
                    autoComplete="off"
                  />
                  {/* Search icon / spinner */}
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {searchLoading ? (
                      <span className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* ─── Autocomplete Dropdown ─── */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 rounded-xl bg-brand-900/95 backdrop-blur-xl border border-brand-700/50 shadow-2xl shadow-black/40 overflow-hidden animate-fade-in" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <div className="px-3 py-2 border-b border-brand-800/40">
                      <span className="text-xs text-gray-500">
                        {searchResults.length} نتيجة
                        {searchResults.length >= 15 && ' (أول 15)'}
                      </span>
                    </div>
                    {searchResults.map((product, index) => (
                      <button
                        key={product.id}
                        onClick={() => selectSearchResult(product)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-right border-b border-brand-800/20 last:border-b-0 ${highlightedIndex === index
                            ? 'bg-brand-700/40'
                            : 'hover:bg-brand-800/40'
                          }`}
                      >
                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-white truncate">{product.name}</span>
                            <span className="text-xs text-gray-500 font-mono shrink-0" dir="ltr">{product.code}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {product.company && (
                              <span
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: `${product.company.color}20`,
                                  color: product.company.color,
                                  border: `1px solid ${product.company.color}30`,
                                }}
                              >
                                {product.company.name}
                              </span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${product.stock > 5 ? 'bg-green-500/15 text-green-400' :
                                product.stock > 0 ? 'bg-yellow-500/15 text-yellow-400' :
                                  'bg-red-500/15 text-red-400'
                              }`}>
                              المخزون: {product.stock}
                            </span>
                          </div>
                        </div>
                        {/* Price */}
                        <div className="text-left shrink-0">
                          <span className="text-sm font-bold text-accent-400">{formatCurrency(product.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {showDropdown === false && nameQuery.trim().length >= 1 && !searchLoading && searchResults.length === 0 && (
                  <div className="absolute z-50 w-full mt-2 rounded-xl bg-brand-900/95 backdrop-blur-xl border border-brand-700/50 shadow-2xl shadow-black/40 p-4 text-center animate-fade-in">
                    <p className="text-sm text-gray-400">لا توجد نتائج لـ "{nameQuery}"</p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Search by Code Mode ─── */}
            {searchMode === 'code' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    ref={codeInputRef}
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
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {lookupLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      بحث...
                    </span>
                  ) : 'بحث'}
                </button>
              </div>
            )}

            {/* Lookup Result */}
            {lookupResult && (
              <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium">{lookupResult.name}</p>
                      {lookupResult.company && (
                        <span
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${lookupResult.company.color}20`,
                            color: lookupResult.company.color,
                            border: `1px solid ${lookupResult.company.color}30`,
                          }}
                        >
                          {lookupResult.company.name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">الكود: <span dir="ltr" className="text-brand-400">{lookupResult.code}</span></p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-accent-400 font-bold">{formatCurrency(lookupResult.price)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${lookupResult.stock > 5 ? 'bg-green-500/15 text-green-400' : lookupResult.stock > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                        المخزون: {lookupResult.stock}
                      </span>
                    </div>
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
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="text-base font-bold text-white mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  الفاتورة ({cart.length} منتج)
                </span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                      <th className="text-right p-3 font-medium">الكود</th>
                      <th className="text-right p-3 font-medium">المنتج</th>
                      <th className="text-right p-3 font-medium">السعر</th>
                      <th className="text-right p-3 font-medium">الكمية</th>
                      <th className="text-right p-3 font-medium">الإجمالي</th>
                      <th className="text-right p-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr key={item.code} className="border-b border-brand-800/20">
                        <td className="p-3 text-sm text-brand-400 font-mono" dir="ltr">{item.code}</td>
                        <td className="p-3 text-sm">
                          <span className="text-white">{item.name}</span>
                          {item.companyName && (
                            <span className="text-xs text-gray-500 mr-2">({item.companyName})</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-gray-400">{formatCurrency(item.price)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => updateQty(item.code, item.quantity - 1)} className="w-7 h-7 rounded bg-brand-800 text-white text-sm hover:bg-brand-700 transition-colors flex items-center justify-center">−</button>
                            <span className="w-8 text-center text-white text-sm">{item.quantity}</span>
                            <button onClick={() => updateQty(item.code, item.quantity + 1)} className="w-7 h-7 rounded bg-brand-800 text-white text-sm hover:bg-brand-700 transition-colors flex items-center justify-center">+</button>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-accent-400 font-bold">{formatCurrency(item.price * item.quantity)}</td>
                        <td className="p-3">
                          <button onClick={() => removeFromCart(item.code)} className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors flex items-center justify-center">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm text-gray-400 mb-1.5">ملاحظات (اختياري)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="ملاحظات على الفاتورة..."
                  className="w-full px-4 py-2 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm resize-none focus:border-brand-500 transition-all"
                />
              </div>

              {/* Total & Submit */}
              <div className="mt-5 pt-4 border-t border-brand-800/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-bold text-white">الإجمالي</span>
                  <span className="text-2xl font-bold text-accent-400">{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={submitInvoice}
                  disabled={submitting || cart.length === 0}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-l from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-base transition-all disabled:opacity-50 shadow-lg shadow-green-500/20"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الإنشاء...
                    </span>
                  ) : `🧾 إنشاء الفاتورة (${formatCurrency(total)})`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================== RESULT ======================== */}
      {tab === 'create' && resultInvoice && (
        <div className="max-w-lg mx-auto glass rounded-2xl p-8 text-center space-y-5 animate-fade-in">
          <div className="text-6xl">✅</div>
          <h3 className="text-xl font-bold text-white">تم إنشاء الفاتورة بنجاح</h3>
          <p className="text-brand-400 font-mono text-2xl font-bold" dir="ltr">{resultInvoice.invoiceNumber}</p>
          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div className="bg-brand-900/50 rounded-xl p-3">
              <p className="text-lg font-bold text-brand-400">{resultInvoice.items?.length || 0}</p>
              <p className="text-xs text-gray-500">منتج</p>
            </div>
            <div className="bg-brand-900/50 rounded-xl p-3">
              <p className="text-lg font-bold text-accent-400">{formatCurrency(resultInvoice.totalAmount)}</p>
              <p className="text-xs text-gray-500">الإجمالي</p>
            </div>
          </div>
          {resultInvoice.customerName && (
            <p className="text-sm text-gray-400">العميل: <span className="text-white">{resultInvoice.customerName}</span></p>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={resetCreate} className="px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all">
              فاتورة جديدة
            </button>
          </div>
        </div>
      )}

      {/* ======================== HISTORY ======================== */}
      {tab === 'history' && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              className="w-full px-4 py-2.5 rounded-lg bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
            />
          </div>

          {loading ? (
            <LoadingSpinner text="جاري تحميل الفواتير..." />
          ) : invoices.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="text-5xl mb-4">🧾</div>
              <p className="text-gray-400 text-lg">لا توجد فواتير</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-brand-800/30 text-sm text-gray-400">
                      <th className="text-right p-4 font-medium">رقم الفاتورة</th>
                      <th className="text-right p-4 font-medium">العميل</th>
                      <th className="text-right p-4 font-medium">المنتجات</th>
                      <th className="text-right p-4 font-medium">الإجمالي</th>
                      <th className="text-right p-4 font-medium">المرتجعات</th>
                      <th className="text-right p-4 font-medium">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-brand-800/20 table-row-hover">
                        <td className="p-4 text-sm text-brand-400 font-mono font-bold" dir="ltr">{inv.invoiceNumber}</td>
                        <td className="p-4 text-sm text-white">
                          {inv.customerName || inv.customer?.name || <span className="text-gray-600">بدون عميل</span>}
                        </td>
                        <td className="p-4 text-sm text-gray-400">
                          {inv.items?.map((item) => (
                            <div key={item.id} className="text-xs">{item.product?.name} × {item.quantity}</div>
                          ))}
                        </td>
                        <td className="p-4 text-sm text-accent-400 font-bold">{formatCurrency(inv.totalAmount)}</td>
                        <td className="p-4 text-sm">
                          {inv._count?.returns > 0 ? (
                            <span className="text-orange-400 text-xs">{inv._count.returns} مرتجع</span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 text-sm text-gray-500">{formatDate(inv.createdAt)}</td>
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
