import React, { useEffect, useMemo, useState } from 'react';
import logoSrc from './assets/t1b.webp';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  CircleDollarSign,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './styles.css';

// ── constants ──────────────────────────────────────────────────────────────────

const pages = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'fees', label: 'Broker Fee', icon: SlidersHorizontal },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'trading', label: 'Trading', icon: Activity },
];

const pageIds = new Set(pages.map(p => p.id));
function getPageFromHash() {
  const hash = window.location.hash.slice(1);
  return pageIds.has(hash) ? hash : 'overview';
}

// ── formatters ─────────────────────────────────────────────────────────────────

const money = v => Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const percent = v => `${(Number(v || 0) * 100).toFixed(3)}%`;

// ── api ────────────────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try { message = (await response.json()).detail || message; } catch { }
    throw new Error(message);
  }
  return response.json();
}

// ── primitive components ───────────────────────────────────────────────────────

function Pill({ variant, children }) {
  const cls = {
    ok: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    neutral: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  }[variant] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {children}
    </span>
  );
}

function Banner({ variant, children }) {
  const cls = variant === 'warning'
    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400';
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm ${cls}`}>{children}</div>
  );
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start gap-3">
      <Icon size={20} className="text-[#d9774a] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <strong className="text-2xl font-bold text-gray-900 dark:text-gray-100 block leading-tight">{value}</strong>
        {detail && <span className="text-xs text-gray-400 dark:text-gray-500">{detail}</span>}
      </div>
    </div>
  );
}

function Panel({ title, children, action }) {
  return (
    <section className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Th = ({ children }) => (
  <th className="px-4 py-3 text-left text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 whitespace-nowrap bg-white dark:bg-[#252525]">
    {children}
  </th>
);

const Td = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-sm text-gray-800 dark:text-gray-200 border-b border-gray-50 dark:border-gray-700/40 ${className}`}>
    {children}
  </td>
);

function InputField({ label, ...props }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300">
      {label}
      <input
        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 h-10 text-sm font-normal outline-none focus:border-[#d9774a] focus:ring-2 focus:ring-[#d9774a]/20 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600"
        {...props}
      />
    </label>
  );
}

// ── sidebar ────────────────────────────────────────────────────────────────────

function SidebarContent({ page, navigate, onClose }) {
  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt="Logo"
            className="h-8 w-8 rounded-full bg-[#d9774a] border border-gray-400 dark:border-gray-700 shrink-0 object-cover"
          />
          <div>
            <p className="font-black italic tracking-tighter text-gray-900 dark:text-gray-100 text-lg leading-none">Broker</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">Admin</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        {pages.map(item => (
          <button
            key={item.id}
            className={`w-full flex items-center gap-4 p-2 rounded-xl transition-all border ${page === item.id
                ? 'bg-[#ebdbd3] dark:bg-[#3d2e26] border-[#d9774a] text-black dark:text-gray-100 font-bold'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
            onClick={() => { navigate(item.id); onClose?.(); }}
          >
            <item.icon size={20} className="shrink-0" />
            <span className="italic text-sm whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

// ── login ──────────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      onLogin(await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#111111] p-6 transition-colors duration-200">
      <form
        className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl dark:shadow-black/40 p-8 w-full max-w-sm flex flex-col gap-5"
        onSubmit={submit}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#d9774a] flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-black italic tracking-tighter text-gray-900 dark:text-gray-100 text-xl leading-none">Broker Admin</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">Platform operations</p>
          </div>
        </div>

        <InputField label="Username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
        <InputField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />

        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}

        <button
          className="h-10 bg-[#d9774a] text-white rounded-lg font-bold text-sm hover:bg-[#c56a3d] transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

// ── overview ───────────────────────────────────────────────────────────────────

function Overview({ isDark }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try { setData(await api('/overview')); }
    catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  const topSymbols = data?.orders?.top_symbols || [];
  const holdings = data?.portfolio?.holdings_by_symbol || [];

  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div className="flex flex-col gap-4">
      {error && <Banner variant="error">{error}</Banner>}
      {data?.errors?.length > 0 && <Banner variant="warning">{data.errors.join(' | ')}</Banner>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total users" value={number(data?.users?.total)} />
        <StatCard icon={UserRoundCog} label="Connected users" value={number(data?.connections?.connected_users)} detail={`${number(data?.connections?.total_connections)} sockets`} />
        <StatCard icon={BadgeDollarSign} label="Fee revenue" value={money(data?.orders?.fee_revenue)} />
        <StatCard icon={CircleDollarSign} label="Platform cash" value={money(data?.wallet?.total_cash)} detail={`${money(data?.wallet?.reserved_cash)} reserved`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Top traded symbols">
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSymbols}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="symbol" tick={{ fontSize: 12, fill: tickColor }} axisLine={{ stroke: gridColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: tickColor }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => money(v)}
                  contentStyle={{ background: isDark ? '#252525' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8, color: isDark ? '#f3f4f6' : '#111827' }}
                />
                <Bar dataKey="traded_notional" fill="#d9774a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Held stock">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><Th>Symbol</Th><Th>Quantity</Th><Th>Holders</Th></tr></thead>
              <tbody>
                {holdings.slice(0, 8).map(item => (
                  <tr key={item.symbol}>
                    <Td className="font-mono font-bold">{item.symbol}</Td>
                    <Td>{number(item.quantity)}</Td>
                    <Td>{number(item.holders)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ── fees ───────────────────────────────────────────────────────────────────────

function Fees() {
  const [data, setData] = useState(null);
  const [rate, setRate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const payload = await api('/fees');
      setData(payload);
      setRate(String(payload.policy.platform_fee_rate));
    } catch (err) { setError(err.message); }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/fees', { method: 'POST', body: JSON.stringify({ platform_fee_rate: Number(rate), reason: reason || null }) });
      setReason('');
      await load();
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Current broker fee">
        {error && <div className="px-4 pt-4"><Banner variant="error">{error}</Banner></div>}
        <div className="p-4 flex flex-col gap-2">
          <strong className="text-4xl font-bold text-gray-900 dark:text-gray-100">{percent(data?.policy?.platform_fee_rate)}</strong>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">{data?.policy?.formula}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{data?.policy?.rounding}</span>
          <p className="font-bold text-gray-700 dark:text-gray-300">{money(data?.policy?.platform_profit_total)} collected</p>
        </div>
        <form className="flex flex-col gap-4 p-4 border-t border-gray-100 dark:border-gray-700" onSubmit={save}>
          <InputField label="Decimal rate" value={rate} onChange={e => setRate(e.target.value)} />
          <InputField label="Change reason" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="h-10 bg-[#d9774a] text-white rounded-lg font-bold text-sm hover:bg-[#c56a3d] transition-colors self-start px-6">
            Update fee
          </button>
        </form>
      </Panel>

      <Panel title="Fee history">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>Rate</Th><Th>Changed by</Th><Th>Reason</Th><Th>Date</Th></tr></thead>
            <tbody>
              {(data?.history ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500 font-mono">
                    No fee changes recorded yet
                  </td>
                </tr>
              ) : data.history.map(item => (
                <tr key={item.id}>
                  <Td className="font-mono font-bold">{percent(item.platform_fee_rate)}</Td>
                  <Td>{item.changed_by}</Td>
                  <Td>{item.reason || '—'}</Td>
                  <Td className="text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── users ──────────────────────────────────────────────────────────────────────

function UsersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [data, setData] = useState({ items: [], total: 0 });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const params = new URLSearchParams({ status, limit: '100', offset: '0' });
      if (query) params.set('q', query);
      setData(await api(`/users?${params}`));
    } catch (err) { setError(err.message); }
  }

  async function openUser(id) { setSelected(await api(`/users/${id}`)); }

  async function suspend(id) {
    const reason = window.prompt('Suspension reason') || null;
    setSelected(await api(`/users/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }));
    await load();
  }

  async function reactivate(id) {
    setSelected(await api(`/users/${id}/reactivate`, { method: 'POST' }));
    await load();
  }

  useEffect(() => { load(); }, [status]);

  return (
    <>
      <Panel
        title="Users"
        action={
          <button
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
            onClick={load} aria-label="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 flex-1 min-w-48 bg-white dark:bg-[#1a1a1a]">
            <Search size={15} className="text-gray-400 dark:text-gray-500 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search username or email"
              className="flex-1 min-w-0 h-9 outline-none text-sm bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600"
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 h-9 text-sm outline-none focus:border-[#d9774a] bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button
            className="h-9 px-4 bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
            onClick={load}
          >
            Search
          </button>
        </div>

        {error && <div className="px-4 py-2"><Banner variant="error">{error}</Banner></div>}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>ID</Th><Th>User</Th><Th>Email</Th><Th>Status</Th><Th>Connection</Th></tr></thead>
            <tbody>
              {data.items.map(user => (
                <tr
                  key={user.id}
                  onClick={() => openUser(user.id)}
                  className="cursor-pointer hover:bg-[#ebdbd3]/30 dark:hover:bg-[#3d2e26]/40 transition-colors"
                >
                  <Td className="font-mono text-gray-400 dark:text-gray-500">{user.id}</Td>
                  <Td className="font-medium">{user.username}</Td>
                  <Td className="text-gray-500 dark:text-gray-400">{user.email}</Td>
                  <Td><Pill variant={user.is_suspended ? 'danger' : 'ok'}>{user.is_suspended ? 'Suspended' : 'Active'}</Pill></Td>
                  <Td><Pill variant={user.is_connected ? 'ok' : 'neutral'}>{user.is_connected ? 'Connected' : 'Offline'}</Pill></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40" onClick={() => setSelected(null)} />
          <aside className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-[#252525] border-l border-gray-200 dark:border-gray-700 shadow-2xl dark:shadow-black/60 p-6 z-50 overflow-y-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-black italic tracking-tighter text-xl text-gray-900 dark:text-gray-100">{selected.username}</h2>
              <button
                onClick={() => setSelected(null)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selected.email}</p>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono">ID {selected.id}</span>
              <Pill variant={selected.is_connected ? 'ok' : 'neutral'}>{selected.is_connected ? 'Connected' : 'Offline'}</Pill>
              <Pill variant={selected.is_suspended ? 'danger' : 'ok'}>{selected.is_suspended ? 'Suspended' : 'Active'}</Pill>
            </div>
            {selected.suspended_reason && (
              <p className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{selected.suspended_reason}</p>
            )}
            <div className="mt-auto">
              {selected.is_suspended ? (
                <button
                  className="w-full h-10 bg-[#d9774a] text-white rounded-lg font-bold text-sm hover:bg-[#c56a3d] transition-colors"
                  onClick={() => reactivate(selected.id)}
                >
                  Reactivate
                </button>
              ) : (
                <button
                  className="w-full h-10 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors"
                  onClick={() => suspend(selected.id)}
                >
                  Suspend
                </button>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

// ── trading ────────────────────────────────────────────────────────────────────

function Trading({ isDark }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/trading').then(setData).catch(() => setData({ errors: ['Unable to load trading data'] }));
  }, []);

  const statuses = data?.orders?.status_breakdown || [];
  const symbols = data?.orders?.top_symbols || [];
  const holdings = data?.portfolio?.holdings_by_symbol || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Panel title="Order status">
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {statuses.map(item => (
                <tr key={item.status}>
                  <Td className="font-mono uppercase text-xs tracking-wider">{item.status}</Td>
                  <Td className="font-bold text-right">{number(item.count)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Bought and sold">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
          <StatCard icon={Activity} label="Bought" value={number(data?.orders?.bought_quantity)} />
          <StatCard icon={Activity} label="Sold" value={number(data?.orders?.sold_quantity)} />
          <StatCard icon={BadgeDollarSign} label="Notional" value={money(data?.orders?.traded_notional)} />
        </div>
      </Panel>

      <Panel title="Symbol activity">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>Symbol</Th><Th>Filled qty</Th><Th>Notional</Th><Th>Fee</Th></tr></thead>
            <tbody>
              {symbols.map(item => (
                <tr key={item.symbol}>
                  <Td className="font-mono font-bold">{item.symbol}</Td>
                  <Td>{number(item.quantity)}</Td>
                  <Td>{money(item.traded_notional)}</Td>
                  <Td>{money(item.platform_fee)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Current holdings">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>Symbol</Th><Th>Held qty</Th><Th>Holders</Th></tr></thead>
            <tbody>
              {holdings.map(item => (
                <tr key={item.symbol}>
                  <Td className="font-mono font-bold">{item.symbol}</Td>
                  <Td>{number(item.quantity)}</Td>
                  <Td>{number(item.holders)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── shell ──────────────────────────────────────────────────────────────────────

function AdminApp({ session, onLogout, isDark, onToggleDark }) {
  const [page, setPage] = useState(getPageFromHash);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activePage = useMemo(() => pages.find(p => p.id === page), [page]);

  function navigate(id) {
    window.location.hash = id;
    setPage(id);
    setSidebarOpen(false);
  }

  async function logout() {
    await api('/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="flex min-h-screen bg-[#f5f5f5] dark:bg-[#111111] transition-colors duration-200">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#f0f0f0] dark:bg-[#252525] border-r border-gray-400 dark:border-gray-700 sticky top-0 h-screen p-4 gap-6 overflow-y-auto transition-colors duration-200">
        <SidebarContent page={page} navigate={navigate} />
      </aside>

      {/* ── Mobile backdrop ── */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Mobile sidebar (slides from left) ── */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 w-64 bg-[#f0f0f0] dark:bg-[#252525] border-r border-gray-400 dark:border-gray-700 flex flex-col p-4 gap-6 lg:hidden transition-transform duration-200 overflow-y-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <SidebarContent page={page} navigate={navigate} onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar */}
        <header className="flex items-center justify-between w-full px-4 sm:px-6 py-2 bg-[#f0f0f0] dark:bg-[#252525] border-b border-gray-300 dark:border-gray-700 font-mono sticky top-0 z-30 transition-colors duration-200">
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold leading-none">Admin panel</p>
              <h1 className="text-xl font-black italic tracking-tighter text-gray-800 dark:text-gray-100 leading-tight">{activePage?.label}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 ml-3">
            <button
              onClick={onToggleDark}
              className="h-9 w-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              className="h-9 w-9 flex items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={logout}
              aria-label="Sign out"
              title={session.username}
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 sm:p-6">
          {page === 'overview' && <Overview isDark={isDark} />}
          {page === 'fees' && <Fees />}
          {page === 'users' && <UsersPage />}
          {page === 'trading' && <Trading isDark={isDark} />}
        </main>
      </div>
    </div>
  );
}

// ── root ───────────────────────────────────────────────────────────────────────

function Root() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    api('/me')
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#111111]">
      <p className="text-gray-400 dark:text-gray-600 font-mono animate-pulse">Loading…</p>
    </div>
  );
  if (!session) return <Login onLogin={setSession} />;
  return (
    <AdminApp
      session={session}
      onLogout={() => setSession(null)}
      isDark={isDark}
      onToggleDark={() => setIsDark(d => !d)}
    />
  );
}

createRoot(document.getElementById('root')).render(<Root />);
