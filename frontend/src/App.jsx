import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import CustomerOrder from './pages/CustomerOrder';
import OrderSuccess from './pages/OrderSuccess';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Companies from './pages/Companies';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Returns from './pages/Returns';
import ImportProducts from './pages/ImportProducts';
import ImportHistory from './pages/ImportHistory';
import PublicInvoice from './pages/PublicInvoice';

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-900">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return admin ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(59,130,246,0.3)',
              fontFamily: 'Cairo',
              direction: 'rtl',
            },
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<CustomerOrder />} />
          <Route path="/order-success/:orderNumber" element={<OrderSuccess />} />
          <Route path="/invoice/:orderNumber" element={<PublicInvoice />} />
          <Route path="/login" element={<Login />} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="companies" element={<Companies />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="returns" element={<Returns />} />
            <Route path="import" element={<ImportProducts />} />
            <Route path="import-history" element={<ImportHistory />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
