import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('البريد الإلكتروني وكلمة المرور مطلوبان');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-900 to-[#0a0f1e] flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-brand-500/30">
            M
          </div>
          <h1 className="text-2xl font-bold text-white">لوحة الإدارة</h1>
          <p className="text-gray-400 text-sm mt-1">مجموعة مجيد - قطع الغيار</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">البريد الإلكتروني</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mageed.com"
              className="w-full px-4 py-3 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">كلمة المرور</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-brand-900/80 border border-brand-800/50 text-white placeholder-gray-500 text-sm focus:border-brand-500 transition-all"
              dir="ltr"
            />
          </div>
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-l from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                جاري الدخول...
              </span>
            ) : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-sm text-gray-500 hover:text-brand-400 transition-colors">
            ← العودة لصفحة الطلب
          </a>
        </div>
      </div>
    </div>
  );
}
