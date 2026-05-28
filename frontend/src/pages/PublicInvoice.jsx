import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { generateInvoiceHtml } from '../utils/invoiceGenerator';

/**
 * Public Invoice Page — accessible without login
 * URL: /invoice/:orderNumber
 * 
 * Fetches order data from a public API endpoint,
 * then renders the invoice HTML in a full-page iframe.
 */
export default function PublicInvoice() {
  const { orderNumber } = useParams();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [html, setHtml] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/invoice/${orderNumber}/data`);
        const order = res.data;
        const invoiceHtml = generateInvoiceHtml(order);
        setHtml(invoiceHtml);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    };
    fetchOrder();
  }, [orderNumber]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 font-medium">جاري تحميل الفاتورة...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-900" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4">📄</div>
          <h2 className="text-xl font-bold text-white mb-2">الفاتورة غير متوفرة</h2>
          <p className="text-gray-400">الرابط غير صالح أو الطلب غير مؤكد بعد</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      title={`فاتورة ${orderNumber}`}
      style={{ width: '100%', height: '100vh', border: 'none' }}
    />
  );
}
