import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/customers', label: 'Customers', icon: Users },
  { to: '/app/invoices', label: 'Invoices', icon: FileText },
  { to: '/app/inventory', label: 'Inventory', icon: Package },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api
      .get('/subscription/status')
      .then((res) => setUsage(res.data))
      .catch(() => {});
  }, [user]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const sidebar = (
    <aside className="h-full w-64 shrink-0 border-r bg-card p-4 flex flex-col">
      <Link to="/app" className="font-bold text-lg mb-6">
        InvoicePro
      </Link>
      <nav className="space-y-1 flex-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="flex h-14 items-center justify-between px-4 gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link to="/app" className="font-bold">
              InvoicePro
            </Link>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline text-muted-foreground truncate max-w-[180px]">{user.email}</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app/settings">Settings</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <div className="hidden md:block sticky top-14 h-[calc(100vh-56px)]">{sidebar}</div>
        {open && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 bg-card">
              <div className="flex justify-end p-2">
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {sidebar}
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 min-w-0">
          <Outlet context={{ usage, setUsage }} />
        </main>
      </div>
    </div>
  );
}
