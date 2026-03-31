'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';

type CreateSystemAdminCardProps = {
  canManageAdmins: boolean;
};

export default function CreateSystemAdminCard({
  canManageAdmins,
}: CreateSystemAdminCardProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageAdmins) {
      setError('Only super admins can create system admin accounts.');
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError('Your admin session expired. Please sign in again.');
      return;
    }

    try {
      setLoading(true);
      resetMessages();

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admins/system-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          name,
          email,
          temporaryPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            admin?: {
              email: string;
            };
          }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to create system admin account.');
        return;
      }

      setSuccess(
        `System admin account created for ${data?.admin?.email ?? email}. Ask them to sign in and change the temporary password.`
      );
      setName('');
      setEmail('');
      setTemporaryPassword('');
    } catch (submitError) {
      console.error(submitError);
      setError('Something went wrong while creating the system admin account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Create System Admin
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            This is a super-admin-only feature. It creates a Firebase Auth user
            and writes a matching <code>admins/{'{uid}'}</code> record with the
            <code>system_admin</code> role and <code>mustChangePassword</code>{' '}
            set to <code>true</code>.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            canManageAdmins
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {canManageAdmins ? 'Super admin only' : 'Locked for this role'}
        </span>
      </div>

      <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Full name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500"
            placeholder="System admin name"
            disabled={loading || !canManageAdmins}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500"
            placeholder="admin@example.com"
            disabled={loading || !canManageAdmins}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
          Temporary password
          <input
            type="text"
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-blue-500"
            placeholder="At least 6 characters"
            disabled={loading || !canManageAdmins}
          />
        </label>

        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">
            {success}
          </p>
        ) : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading || !canManageAdmins}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create system admin'}
          </button>
        </div>
      </form>
    </section>
  );
}
