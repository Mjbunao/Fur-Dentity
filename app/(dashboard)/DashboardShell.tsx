'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { auth, signOut } from '@/lib/firebase';
import type { AdminRole } from '@/lib/auth/types';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/reports', label: 'Reports' },
  { href: '/adoption', label: 'Adoption' },
  { href: '/donation', label: 'Donation' },
  { href: '/users', label: 'Users' },
  { href: '/pets', label: 'Pets' },
  { href: '/gps-devices', label: 'GPS Device' },
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

  const handleLogout = async () => {
    try {
      await fetch('/api/session/logout', {
        method: 'POST',
      });
    } finally {
      await signOut(auth).catch(() => undefined);
      sessionStorage.clear();
      router.replace('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-72 md:border-b-0 md:border-r">
          <div className="flex justify-center px-6 py-5">
            <div className="flex items-center gap-3">
              <Image
                src="/A4 - 1 (2).png"
                alt="Fur-Dentity logo"
                width={38}
                height={38}
                className="h-10 w-10 rounded-xl object-cover"
              />
              <h1 className="mt-3 text-2xl font-bold">Fur-Dentity</h1>
            </div>
          </div>

          <nav className="flex text-center gap-2 overflow-x-auto px-4 pb-4 md:flex-col md:overflow-visible md:px-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-2xl py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-warning opacity-50 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4 md:px-10">
              <div>
          
                <h2 className="text-lg font-semibold text-slate-900">
                  {navItems.find((item) => item.href === pathname)?.label ?? 'Dashboard'}
                </h2>
              </div>

              <div ref={menuRef} className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifOpen((prev) => !prev);
                      setIsProfileOpen(false);
                    }}
                    className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
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
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen((prev) => !prev);
                      setIsNotifOpen(false);
                    }}
                    className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
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
                    <div className="absolute right-0 mt-3 w-56 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
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

          <main className="flex-1 p-6 md:p-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
