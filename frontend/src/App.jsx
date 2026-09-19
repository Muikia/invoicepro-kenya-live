import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import Landing from '@/pages/Landing';
import Signup from '@/pages/Signup';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import Receipt from '@/pages/Receipt';
import Dashboard from '@/pages/Dashboard';
import Customers from '@/pages/Customers';
import Invoices from '@/pages/Invoices';
import InvoiceDetail from '@/pages/InvoiceDetail';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';
import Upgrade from '@/pages/Upgrade';
import Pricing from '@/pages/Pricing';
import Inventory from '@/pages/Inventory';
import VatReport from '@/pages/VatReport';
import VerifyPhone from '@/pages/VerifyPhone';

function homeFor(user) {
  if (!user) return '/';
  return '/app';
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to={homeFor(user)} replace /> : <Landing />} />
      <Route path="/signup" element={user ? <Navigate to={homeFor(user)} replace /> : <Signup />} />
      <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/receipt/:id" element={<Receipt />} />
      <Route path="/verify-email" element={<Navigate to={user ? '/app' : '/signup'} replace />} />
      <Route path="/verify-phone" element={user ? <VerifyPhone /> : <Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="analytics/vat" element={<VatReport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="upgrade" element={<Upgrade />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
