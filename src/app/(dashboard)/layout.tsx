'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut } from 'next-auth/react';
import {
  LogOut,
  User,
  Settings,
  LayoutDashboard,
  FileText,
  BarChart3,
  ChevronDown,
  Menu,
  Building2,
  Database,
  UserCog,
  ClipboardList,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n, t } from '@/lib/i18n';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { hasPermission, isSalesRole, normalizeRole } from '@/lib/permissions';

type NavigationItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  description: string;
  permission:
    | 'accessDashboard'
    | 'accessQuotations'
    | 'accessReports'
    | 'accessMasterData'
    | 'accessSalesTasks';
};

const BASE_NAVIGATION: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview and quick stats',
    permission: 'accessDashboard',
  },
  {
    name: 'Quotations',
    href: '/quotations',
    icon: FileText,
    description: 'Manage freight quotations',
    permission: 'accessQuotations',
  },
  {
    name: 'Sales task',
    href: '/sales-tasks',
    icon: ClipboardList,
    description: 'Meeting reports and follow-ups',
    permission: 'accessSalesTasks',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    description: 'Sales KPIs and analytics',
    permission: 'accessReports',
  },
  {
    name: 'Master Data',
    href: '/master',
    icon: Database,
    description: 'Manage synced reference catalogs',
    permission: 'accessMasterData',
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lang, setLang } = useI18n();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const role = normalizeRole(session?.user?.role);

  const navigationItems = useMemo(
    () =>
      BASE_NAVIGATION.filter((item) => {
        if (!hasPermission(role, item.permission)) return false;
        if (isSalesRole(role) && item.href === '/reports') return false;
        return true;
      }),
    [role],
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-32 w-32 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading ТУУШИН ХХК System...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left side - Logo and Mobile Menu */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="mr-2 lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                  <span className="text-sm font-bold text-white">T</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">ТУУШИН ХХК</h1>
                  <p className="hidden text-xs text-gray-500 sm:block">Freight Management System</p>
                </div>
              </div>
            </div>

            {/* Right side - User menu and compact KPIs */}
            <div className="flex items-center space-x-4">
              {/* Compact KPI strip only when not on dashboard */}
              {!pathname.startsWith('/dashboard') && (
                <div className="hidden max-w-[48rem] lg:block">
                  <KpiStrip compact={true} />
                </div>
              )}
              <div className="hidden items-center space-x-3 text-sm sm:flex">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium text-gray-700">{session.user?.name}</span>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                  {session.user?.role}
                </span>
              </div>

              {/* Language Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2 text-xs sm:px-4 sm:text-sm">
                    <span className="hidden sm:inline">{t('common.language')}: </span>
                    <span className="sm:hidden">{lang === 'en' ? 'EN' : 'MN'}</span>
                    <span className="hidden sm:inline">
                      {lang === 'en' ? t('common.english') : t('common.mongolian')}
                    </span>
                    <ChevronDown className="ml-1 h-3 w-3 sm:ml-2 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setLang('en')}>
                    {t('common.english')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang('mn')}>
                    {t('common.mongolian')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="px-2 sm:px-4">
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Settings</span>
                    <ChevronDown className="ml-1 h-3 w-3 sm:ml-2 sm:h-4 sm:w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm text-gray-700">
                    <div className="font-medium">{session.user?.name}</div>
                    <div className="text-xs text-gray-500">{session.user?.email}</div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                    <UserCog className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {hasPermission(role, 'manageCompanySettings') && (
                    <DropdownMenuItem onClick={() => router.push('/settings/company')}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Company Settings
                    </DropdownMenuItem>
                  )}
                  {hasPermission(role, 'manageUsers') && (
                    <DropdownMenuItem onClick={() => router.push('/users')}>
                      <User className="mr-2 h-4 w-4" />
                      User Management
                    </DropdownMenuItem>
                  )}
                  {(hasPermission(role, 'manageCompanySettings') ||
                    hasPermission(role, 'manageUsers')) && <DropdownMenuSeparator />}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed top-16 left-0 z-40 h-full w-64 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full overflow-y-auto border-r border-gray-200 bg-white px-3 py-4">
          <nav className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-r-2 border-blue-600 bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <div>{item.name}</div>
                    <div className="hidden text-xs text-gray-500 xl:block">{item.description}</div>
                  </div>
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="pt-16 lg:pl-64">
        <div className="px-2 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">{children}</div>
      </main>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="bg-opacity-50 fixed inset-0 z-30 bg-gray-600 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
