'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { auth, onAuthStateChanged, signOut } from '@/lib/firebase';
import type { AdminRole } from '@/lib/auth/types';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import NotificationsDropdown from './NotificationsDropdown';

import {
  AdminPanelSettingsIcon,
  AssessmentRoundedIcon,
  BadgeIcon,
  DarkModeRoundedIcon,
  DashboardIcon,
  ExpandMoreRoundedIcon,
  GpsFixedSharpIcon,
  HealthAndSafetySharpIcon,
  HistoryRoundedIcon,
  LightModeRoundedIcon,
  LogoutRoundedIcon,
  MonetizationOnSharpIcon,
  PeopleAltSharpIcon,
  PetsSharpIcon,
  ReportProblemRoundedIcon,
  RestoreFromTrashRoundedIcon,
  SettingsRoundedIcon,
} from '@/components/icons';

const THEME_STORAGE_KEY = 'fur-dentity-theme';

type NavChild = {
  href: string;
  label: string;
  roles: AdminRole[];
  icon?: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
  roles?: AdminRole[];
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: <DashboardIcon sx={{fontSize: 20}}/> },
  { href: '/reports', label: 'Reports', icon: <ReportProblemRoundedIcon sx={{fontSize: 20}}/> },
  { href: '/adoption', label: 'Adoption', icon: <HealthAndSafetySharpIcon sx={{fontSize: 20}}/> },
  { href: '/donation', label: 'Donation', icon: <MonetizationOnSharpIcon sx={{fontSize: 20}}/> },
  {
    href: '/users',
    label: 'Users',
    icon: <PeopleAltSharpIcon sx={{fontSize: 20}}/>,
    children: [
      {
        href: '/users',
        label: 'User Directory',
        roles: ['super_admin', 'system_admin'] as AdminRole[],
        icon: <BadgeIcon sx={{ fontSize: 16 }} />,
      },
      {
        href: '/users/system-admins',
        label: 'System Admin',
        roles: ['super_admin'] as AdminRole[],
        icon: <AdminPanelSettingsIcon sx={{ fontSize: 16 }} />,
      },
    ],
  },
  { href: '/pets', label: 'Pets', icon: <PetsSharpIcon sx={{fontSize: 20}}/> },
  { href: '/gps-devices', label: 'GPS Device', icon: <GpsFixedSharpIcon sx={{fontSize: 20}}/> },
];

type DashboardShellProps = {
  adminEmail: string;
  adminName?: string;
  adminRole: AdminRole;
  children: React.ReactNode;
};

export default function DashboardShell({
  adminEmail,
  adminName,
  adminRole,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(
    pathname === '/users' || pathname.startsWith('/users/')
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setIsSettingsOpen(false);
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = storedTheme ? storedTheme === 'dark' : prefersDark;

    document.documentElement.classList.toggle('dark', shouldUseDark);
    window.localStorage.setItem(THEME_STORAGE_KEY, shouldUseDark ? 'dark' : 'light');
    window.dispatchEvent(new Event('fur-dentity-theme-change'));
    setIsDarkMode(shouldUseDark);
  }, []);

  useEffect(() => {
    if (pathname === '/users' || pathname.startsWith('/users/')) {
      setIsUsersExpanded(true);
    }
  }, [pathname]);

  useEffect(() => {
    let isCancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      const validateSession = async () => {
        if (!currentUser) {
          await fetch('/api/session/logout', {
            method: 'POST',
          }).catch(() => undefined);

          if (!isCancelled) {
            router.replace('/');
          }
          return;
        }

        try {
          const idToken = await currentUser.getIdToken(true);
          const response = await fetch('/api/session/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken }),
          });

          if (!response.ok) {
            await signOut(auth).catch(() => undefined);
            sessionStorage.clear();

            if (!isCancelled) {
              router.replace('/');
            }
          }
        } catch {
          await fetch('/api/session/logout', {
            method: 'POST',
          }).catch(() => undefined);
          await signOut(auth).catch(() => undefined);
          sessionStorage.clear();

          if (!isCancelled) {
            router.replace('/');
          }
        }
      };

      void validateSession();
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null);
      await fetch('/api/session/logout', {
        method: 'POST',
        headers: idToken
          ? {
              Authorization: `Bearer ${idToken}`,
            }
          : undefined,
      });
    } finally {
      await signOut(auth).catch(() => undefined);
      sessionStorage.clear();
      router.replace('/');
    }
  };

  const handleToggleDarkMode = () => {
    const nextValue = !isDarkMode;
    document.documentElement.classList.toggle('dark', nextValue);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextValue ? 'dark' : 'light');
    setIsDarkMode(nextValue);
    window.dispatchEvent(new Event('fur-dentity-theme-change'));
  };

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentNavItem =
    navItems.find((item) => isNavItemActive(item.href)) ??
    navItems.find((item) => item.href === pathname);
  const currentPageLabel = pathname.startsWith('/activity-logs')
    ? 'Activity Logs'
    : pathname.startsWith('/general-reports')
      ? 'General Reports'
    : pathname.startsWith('/recovery')
      ? 'Recovery'
    : currentNavItem?.label ?? 'Dashboard';
  const appShellClass = isDarkMode
    ? 'min-h-screen bg-slate-950 text-slate-100'
    : 'min-h-screen bg-slate-100 text-slate-900';
  const sidebarClass = isDarkMode
    ? 'w-full bg-slate-900 shadow-[8px_0_28px_rgba(0,0,0,0.25)] md:sticky md:top-0 md:h-screen md:w-60'
    : 'w-full bg-white shadow-[8px_0_28px_rgba(15,23,42,0.05)] md:sticky md:top-0 md:h-screen md:w-60';
  const contentShellClass = isDarkMode
    ? 'flex min-h-screen min-w-0 flex-1 flex-col bg-slate-950'
    : 'flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100';
  const headerClass = isDarkMode
    ? 'sticky top-0 z-30 bg-slate-900/95 shadow-[0_10px_28px_rgba(0,0,0,0.25)] backdrop-blur'
    : 'sticky top-0 z-30 bg-white/95 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur';

  return (
    <div className={appShellClass}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className={`${sidebarClass} fd-animate-slide-right`}>
          <div className="flex justify-center px-6 py-5">
            <div className="flex items-center gap-3">
              <Image
                src="/A4 - 1 (2).png"
                alt="Fur-Dentity logo"
                width={38}
                height={38}
                className="h-10 w-10 rounded-xl object-cover"
              />
              <h1 className={`mt-3 text-xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Fur-Dentity</h1>
            </div>
          </div>

          <nav className="flex text-center gap-1 overflow-x-auto px-4 pb-4 md:flex-col md:overflow-visible md:px-4">
            {navItems.map((item, index) => {
              if ('roles' in item && item.roles && !item.roles.includes(adminRole)) {
                return null;
              }

              const isActive = isNavItemActive(item.href);
              const visibleChildren = item.children ?? [];

              return (
                <div
                  key={item.href}
                  className="fd-animate-slide-right flex flex-col gap-1"
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                >
                  {item.children ? (
                    <button
                      type="button"
                      onClick={() => setIsUsersExpanded((current) => !current)}
                      className={`flex items-center justify-between gap-3 rounded-2xl px-10 py-2 text-sm transition ${
                        isActive
                          ? `text-primary ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`
                          : isDarkMode
                            ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon ? (
                          <span className="flex h-5 w-5 items-center justify-center">
                            {item.icon}
                          </span>
                        ) : null}
                        <span className={isActive ? 'font-bold' : 'font-normal'}>
                          {item.label}
                        </span>
                      </span>
                      <ExpandMoreRoundedIcon
                        sx={{ fontSize: 18 }}
                        className={`transition-transform duration-200 ${
                          isUsersExpanded ? 'rotate-180' : 'rotate-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 rounded-2xl px-10 py-2 text-sm transition ${
                        isActive
                          ? `text-primary ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`
                          : isDarkMode
                            ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      {item.icon ? (
                        <span className="flex h-5 w-5 items-center justify-center">
                          {item.icon}
                        </span>
                      ) : null}
                      <span className={isActive ? 'font-bold' : 'font-normal'}>
                        {item.label}
                      </span>
                    </Link>
                  )}

                  <div
                    className={`ml-8 grid overflow-hidden transition-all duration-200 ${
                      visibleChildren.length > 0 && isUsersExpanded
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0">
                      <div className="flex flex-col gap-1 pt-1">
                      {visibleChildren.map((child) => {
                        const canAccess = child.roles.includes(adminRole);
                        const isChildActive =
                          child.href === '/users'
                            ? pathname === child.href
                            : pathname === child.href || pathname.startsWith(`${child.href}/`);

                        if (!canAccess) {
                          return (
                            <div
                              key={child.href}
                              className="flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl px-4 py-2 text-left text-xs text-slate-400 opacity-80"
                              aria-disabled="true"
                              title="Only available to super admins"
                            >
                              {child.icon ? (
                                <span className="flex h-4 w-4 items-center justify-center">
                                  {child.icon}
                                </span>
                              ) : null}
                              <span className='text-sm'>{child.label}</span>
                            </div>
                          );
                        }

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-left text-xs transition ${
                              isChildActive
                                ? `${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} font-semibold text-primary`
                                : isDarkMode
                                  ? 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            {child.icon ? (
                              <span className="flex h-4 w-4 items-center justify-center ">
                                {child.icon}
                              </span>
                            ) : null}
                            <span className="text-sm">
                              {child.label}
                            </span>
                            
                          </Link>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className={contentShellClass}>
          <header className={headerClass}>
            <div className="flex items-center justify-between px-6 py-2 md:px-10 ">
              <div>
          
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {currentPageLabel}
                </h2>
              </div>

              <div ref={menuRef} className="flex items-center gap-3">
                <NotificationsDropdown
                  isOpen={isNotifOpen}
                  isDarkMode={isDarkMode}
                  onToggle={() => {
                    setIsNotifOpen((prev) => !prev);
                    setIsProfileOpen(false);
                    setIsSettingsOpen(false);
                  }}
                  onClose={() => setIsNotifOpen(false)}
                />
                {false ? <div className="hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifOpen((prev) => !prev);
                      setIsProfileOpen(false);
                    }}
                    className="relative flex h-11 w-11 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    aria-label="Open notifications"
                  >
                    <span className="text-lg">🔔</span>
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
                  </button>

                  {isNotifOpen && (
                    <div className="absolute right-0 mt-3 w-80 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Notifications
                        </h3>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                          2 new
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-sm font-medium text-slate-800">
                            Migration placeholder
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Hook your Firebase notification data here later.
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3">
                          <p className="text-sm font-medium text-slate-800">
                            Header is ready
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            This top nav stays visible on every dashboard route.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div> : null}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen((prev) => !prev);
                      setIsSettingsOpen(false);
                      setIsNotifOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-[10px] bg-transparent py-1.5 pl-1.5 pr-3 transition ${
                      isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <Image
                        src="/spn-logo.png"
                        alt="Admin profile"
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="hidden text-left md:block">
                      <p className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {adminName || 'Admin'}
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {adminRole === 'super_admin'
                          ? 'Super administrator'
                          : 'System administrator'}
                      </p>
                    </div>
                  </button>

                  {isProfileOpen && (
                    <div className={`fd-animate-scale-in absolute right-0 mt-3 w-[320px] overflow-hidden rounded-[12px] shadow-xl ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                      <div className={`px-4 py-3 ${isDarkMode ? 'shadow-[0_8px_18px_rgba(0,0,0,0.18)]' : 'shadow-[0_8px_18px_rgba(15,23,42,0.04)]'}`}>
                        <h3 className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>Profile</h3>
                        <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {adminRole === 'super_admin' ? 'Super administrator' : 'System administrator'}
                        </p>
                      </div>

                      <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen((current) => !current)}
                        className={`flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold transition ${
                          isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <SettingsRoundedIcon sx={{ fontSize: 16 }} />
                          Settings
                        </span>
                        <ExpandMoreRoundedIcon
                          sx={{ fontSize: 16 }}
                          className={`transition-transform ${isSettingsOpen ? 'rotate-180' : 'rotate-0'}`}
                        />
                      </button>

                      <div
                        className={`grid overflow-hidden transition-all duration-200 ${
                          isSettingsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="min-h-0">
                          <div className={`mt-1 space-y-1 rounded-[8px] p-1.5 ${isDarkMode ? 'bg-slate-800/80' : 'bg-slate-50'}`}>
                            <button
                              type="button"
                              onClick={handleToggleDarkMode}
                              className={`flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-left text-xs font-semibold transition ${
                                isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {isDarkMode ? (
                                  <LightModeRoundedIcon sx={{ fontSize: 16 }} />
                                ) : (
                                  <DarkModeRoundedIcon sx={{ fontSize: 16 }} />
                                )}
                                Dark mode
                              </span>
                              <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {isDarkMode ? 'On' : 'Off'}
                              </span>
                            </button>

                            {adminRole === 'super_admin' ? (
                              <>
                                <Link
                                  href="/activity-logs"
                                  onClick={() => {
                                    setIsProfileOpen(false);
                                    setIsSettingsOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-xs font-semibold transition ${
                                    isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <HistoryRoundedIcon sx={{ fontSize: 16 }} />
                                  Activity Logs
                                </Link>
                                <Link
                                  href="/general-reports"
                                  onClick={() => {
                                    setIsProfileOpen(false);
                                    setIsSettingsOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-xs font-semibold transition ${
                                    isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <AssessmentRoundedIcon sx={{ fontSize: 16 }} />
                                  General Reports
                                </Link>
                                <Link
                                  href="/recovery"
                                  onClick={() => {
                                    setIsProfileOpen(false);
                                    setIsSettingsOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left text-xs font-semibold transition ${
                                    isDarkMode ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-200'
                                  }`}
                                >
                                  <RestoreFromTrashRoundedIcon sx={{ fontSize: 16 }} />
                                  Recovery
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          setIsSettingsOpen(false);
                          setIsLogoutConfirmOpen(true);
                        }}
                        className={`mt-1 flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold transition ${
                          isDarkMode ? 'text-red-400 hover:bg-red-950/40' : 'text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <LogoutRoundedIcon sx={{ fontSize: 16 }} />
                        Logout
                      </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main key={pathname} className="fd-animate-fade-up flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={isLogoutConfirmOpen}
        title="Log out?"
        description="You will need to sign in again before accessing the admin dashboard."
        confirmLabel="Logout"
        confirmColor="error"
        confirmIcon="close"
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => {
          setIsLogoutConfirmOpen(false);
          void handleLogout();
        }}
      />
    </div>
  );
}
