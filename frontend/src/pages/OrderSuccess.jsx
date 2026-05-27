import { useParams, Link } from 'react-router-dom';

export default function OrderSuccess() {
  const { orderNumber } = useParams();

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-[#0a0f1e] flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">تم إرسال الطلب بنجاح!</h1>
        <p className="text-gray-400 mb-6">سيتم مراجعة طلبك والتواصل معك قريباً</p>

        <div className="p-4 rounded-xl bg-brand-800/40 border border-brand-700/30 mb-6">
          <p className="text-sm text-gray-400 mb-1">رقم الطلب</p>
          <p className="text-xl font-bold text-brand-400" dir="ltr">{orderNumber}</p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          طلب جديد
        </Link>
      </div>
    </div>
  );
}
