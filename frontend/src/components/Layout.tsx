import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlobalSearch from './GlobalSearch';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <nav className="bg-dark-800 border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/dashboard" className="flex items-center text-xl font-semibold text-white hover:text-gray-200 transition-colors">
                SpecterCRM
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/organizations"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Organizations
                </Link>
                <Link
                  to="/contacts"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Contacts
                </Link>
                <Link
                  to="/deals"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Deals
                </Link>
                <Link
                  to="/pipeline"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Pipeline
                </Link>
                <Link
                  to="/activities"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Activities
                </Link>
                <Link
                  to="/reports"
                  className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors"
                >
                  Reports
                </Link>
                {user?.role === 'ADMIN' && (
                  <div className="relative group inline-flex items-center">
                    <button className="inline-flex items-center px-3 pt-1 text-sm font-medium text-gray-300 hover:text-white hover:bg-dark-700 rounded-md transition-colors">
                      Admin
                    </button>
                    <div className="hidden group-hover:block absolute left-0 top-full mt-1 w-48 rounded-lg shadow-lg card z-50">
                      <div className="py-1">
                        <Link
                          to="/admin/users"
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          Users
                        </Link>
                        <Link
                          to="/admin/activity-types"
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          Settings
                        </Link>
                        <Link
                          to="/deduplication"
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          Deduplication
                        </Link>
                        <Link
                          to="/admin/audit-logs"
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          Audit Logs
                        </Link>
                        <Link
                          to="/admin/import"
                          className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-dark-700 transition-colors"
                        >
                          Import Data
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/profile"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {user?.firstName || user?.email}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
          <div className="border-t border-dark-700 py-3">
            <GlobalSearch />
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
