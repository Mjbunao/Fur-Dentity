'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { auth, signOut } from '@/lib/firebase';
import type { AdminRole } from '@/lib/auth/types';
import NotificationsDropdown from './NotificationsDropdown';

import { AdminPanelSettingsIcon, BadgeIcon, DashboardIcon, ExpandMoreRoundedIcon, ReportProblemRoundedIcon, PetsSharpIcon, MonetizationOnSharpIcon,PeopleAltSharpIcon,HealthAndSafetySharpIcon,GpsFixedSharpIcon, HistoryRoundedIcon } from '@/components/icons';

const navItems = [
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
  { href: '/activity-logs', label: 'Activity Logs', icon: <HistoryRoundedIcon sx={{fontSize: 20}}/>, roles: ['super_admin'] as AdminRole[] },
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
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUsersExpanded, setIsUsersExpanded] = useState(
    pathname === '/users' || pathname.startsWith('/users/')
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setIsNotifOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pathname === '/users' || pathname.startsWith('/users/')) {
      setIsUsersExpanded(true);
    }
  }, [pathname]);

  useEffect(() => {
    const validateSession = async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        await fetch('/api/session/logout', {
          method: 'POST',
        }).catch(() => undefined);
        router.replace('/');
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
          router.replace('/');
        }
      } catch {
        await fetch('/api/session/logout', {
          method: 'POST',
        }).catch(() => undefined);
        await signOut(auth).catch(() => undefined);
        sessionStorage.clear();
        router.replace('/');
      }
    };

    void validateSession();
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

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentNavItem =
    navItems.find((item) => isNavItemActive(item.href)) ??
    navItems.find((item) => item.href === pathname);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full bg-white shadow-[8px_0_28px_rgba(15,23,42,0.05)] md:sticky md:top-0 md:h-screen md:w-60">
          <div className="flex justify-center px-6 py-5">
            <div className="flex items-center gap-3">
              <Image
                src="/A4 - 1 (2).png"
                alt="Fur-Dentity logo"
                width={38}
                height={38}
                className="h-10 w-10 rounded-xl object-cover"
              />
              <h1 className="mt-3 text-xl font-bold">Fur-Dentity</h1>
            </div>
          </div>

          <nav className="flex text-center gap-1 overflow-x-auto px-4 pb-4 md:flex-col md:overflow-visible md:px-4">
            {navItems.map((item) => {
              if ('roles' in item && item.roles && !item.roles.includes(adminRole)) {
                return null;
              }

              const isActive = isNavItemActive(item.href);
              const visibleChildren = item.children ?? [];

              return (
                <div key={item.href} className="flex flex-col gap-1">
                  {item.children ? (
                    <button
                      type="button"
                      onClick={() => setIsUsersExpanded((current) => !current)}
                      className={`flex items-center justify-between gap-3 rounded-2xl px-10 py-2 text-sm transition ${
                        isActive
                          ? 'text-primary bg-slate-100'
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
                          ? 'text-primary bg-slate-100'
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
                                ? 'bg-slate-100 font-semibold text-primary'
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

        <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-slate-100">
          <header className="sticky top-0 z-30 bg-white/95 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
            <div className="flex items-center justify-between px-6 py-2 md:px-10 ">
              <div>
          
                <h2 className="text-lg font-semibold text-slate-900">
                  {currentNavItem?.label ?? 'Dashboard'}
                </h2>
              </div>

              <div ref={menuRef} className="flex items-center gap-3">
                <NotificationsDropdown
                  isOpen={isNotifOpen}
                  onToggle={() => {
                    setIsNotifOpen((prev) => !prev);
                    setIsProfileOpen(false);
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
                      setIsNotifOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-[10px] bg-transparent py-1.5 pl-1.5 pr-3 transition hover:bg-slate-100"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200">
                      <Image
                        src="/spn-logo.png"
                        alt="Admin profile"
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="hidden text-left md:block">
                      <p className="text-sm font-semibold text-slate-900">
                        {adminName || 'Admin'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {adminRole === 'super_admin'
                          ? 'Super administrator'
                          : 'System administrator'}
                      </p>
                    </div>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-3 w-56 rounded-3xl bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        className="flex w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {adminEmail}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full rounded-2xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
