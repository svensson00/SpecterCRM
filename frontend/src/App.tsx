import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Organizations from './pages/Organizations';
import OrganizationDetail from './pages/OrganizationDetail';
import OrganizationForm from './pages/OrganizationForm';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import ContactForm from './pages/ContactForm';
import Deals from './pages/Deals';
import DealDetail from './pages/DealDetail';
import DealForm from './pages/DealForm';
import Pipeline from './pages/Pipeline';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import ActivityForm from './pages/ActivityForm';
import Reports from './pages/Reports';
import Deduplication from './pages/Deduplication';
import Users from './pages/admin/Users';
import ActivityTypes from './pages/admin/ActivityTypes';
import AuditLogs from './pages/admin/AuditLogs';
import Import from './pages/Import';
import Profile from './pages/Profile';
import Layout from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="organizations" element={<Organizations />} />
        <Route path="organizations/new" element={<OrganizationForm />} />
        <Route path="organizations/:id" element={<OrganizationDetail />} />
        <Route path="organizations/:id/edit" element={<OrganizationForm />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/new" element={<ContactForm />} />
        <Route path="contacts/:id" element={<ContactDetail />} />
        <Route path="contacts/:id/edit" element={<ContactForm />} />
        <Route path="deals" element={<Deals />} />
        <Route path="deals/new" element={<DealForm />} />
        <Route path="deals/:id" element={<DealDetail />} />
        <Route path="deals/:id/edit" element={<DealForm />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="activities" element={<Activities />} />
        <Route path="activities/new" element={<ActivityForm />} />
        <Route path="activities/:id" element={<ActivityDetail />} />
        <Route path="activities/:id/edit" element={<ActivityForm />} />
        <Route path="reports" element={<Reports />} />
        <Route path="deduplication" element={<Deduplication />} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin/users" element={<Users />} />
        <Route path="admin/activity-types" element={<ActivityTypes />} />
        <Route path="admin/audit-logs" element={<AuditLogs />} />
        <Route path="admin/import" element={<Import />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
