import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import logoSrc from './assets/t1b.webp';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  BarChart3,
  Bot,
  Brain,
  CircleDollarSign,
  LogOut,
  Menu,
  Moon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Sun,
  Target,
  TrendingUp,
  UserRoundCog,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  { id: 'bot', label: 'Bot Service', icon: Bot },
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

// ── bot service ────────────────────────────────────────────────────────────────

const BOT_STATE_STYLES = {
  running:  { bg: 'bg-green-100  dark:bg-green-900/30',  fg: 'text-green-700  dark:text-green-400',  dot: 'bg-green-500',  pulse: false, label: 'RUNNING' },
  starting: { bg: 'bg-blue-100   dark:bg-blue-900/30',   fg: 'text-blue-700   dark:text-blue-400',   dot: 'bg-blue-500',   pulse: true,  label: 'STARTING' },
  thinking: { bg: 'bg-blue-100   dark:bg-blue-900/30',   fg: 'text-blue-700   dark:text-blue-400',   dot: 'bg-blue-500',   pulse: true,  label: 'THINKING' },
  buying:   { bg: 'bg-[#ebdbd3]  dark:bg-[#3d2e26]',     fg: 'text-[#d9774a]',                       dot: 'bg-[#d9774a]',  pulse: true,  label: 'BUYING' },
  selling:  { bg: 'bg-amber-100  dark:bg-amber-900/30',  fg: 'text-amber-700  dark:text-amber-400',  dot: 'bg-amber-500',  pulse: true,  label: 'SELLING' },
  managing: { bg: 'bg-teal-100   dark:bg-teal-900/30',   fg: 'text-teal-700   dark:text-teal-400',   dot: 'bg-teal-500',   pulse: false, label: 'MANAGING' },
  paused:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', fg: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500', pulse: false, label: 'PAUSED' },
  halted:   { bg: 'bg-orange-100 dark:bg-orange-900/30', fg: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500', pulse: false, label: 'HALTED' },
  stopped:  { bg: 'bg-gray-200   dark:bg-gray-800',      fg: 'text-gray-700   dark:text-gray-300',   dot: 'bg-gray-500',   pulse: false, label: 'STOPPED' },
  error:    { bg: 'bg-red-100    dark:bg-red-900/30',    fg: 'text-red-700    dark:text-red-400',    dot: 'bg-red-500',    pulse: false, label: 'ERROR' },
};

const PIE_COLORS = ['#d9774a', '#3d405b', '#81b29a', '#9ca3af', '#f2cc8f', '#6d6875'];

function botStateOf(summary) {
  if (!summary) return 'stopped';
  if (summary.runtime_state) return summary.runtime_state;
  if (!summary.is_running) return 'stopped';
  return summary.status === 'active' ? 'running' : (summary.status || 'stopped');
}

function StatusPill({ state, size = 'md' }) {
  const cfg = BOT_STATE_STYLES[state] || BOT_STATE_STYLES.stopped;
  const pad = size === 'lg' ? 'px-3 py-1.5 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold tracking-wider ${pad} ${cfg.bg} ${cfg.fg}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

function pnlClass(v) {
  const n = Number(v || 0);
  if (n > 0) return 'text-green-600 dark:text-green-400';
  if (n < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-900 dark:text-gray-100';
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '—';
  const diffMs = Date.now() - dt.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── data hook ──
// Polls REST snapshots on mount + interval, AND maintains a WebSocket that
// pushes incremental updates from Kafka.  Either alone works; together they
// give cheap warm cache + low-latency live updates.

function useBotStream({ sessionId, pollMs = 5000 }) {
  const [list, setList] = useState({ items: [], total: 0 });
  const [summary, setSummary] = useState(null);          // detail-view session
  const [holdings, setHoldings] = useState([]);
  const [equity, setEquity] = useState([]);
  const [trades, setTrades] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [events, setEvents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [globalMetrics, setGlobalMetrics] = useState(null);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const wsBackoffRef = useRef(1000);

  const isDetail = Boolean(sessionId);

  const refreshList = useCallback(async () => {
    try {
      const data = await api('/bots');
      setList(data);
      const m = await api('/bots/metrics');
      setGlobalMetrics(m);
    } catch (e) { setError(e.message); }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [s, h, e, t, d, ev, m] = await Promise.all([
        api(`/bots/${sessionId}`),
        api(`/bots/${sessionId}/holdings`),
        api(`/bots/${sessionId}/equity?range=24h`),
        api(`/bots/${sessionId}/trades?limit=100`),
        api(`/bots/${sessionId}/decisions?limit=200`),
        api(`/bots/${sessionId}/events?limit=200`),
        api(`/bots/${sessionId}/metrics?window=24h`),
      ]);
      setSummary(s);
      setHoldings(h.items || []);
      setEquity(e.items || []);
      setTrades(t.items || []);
      setDecisions(d.items || []);
      setEvents(ev.items || []);
      setMetrics(m);
    } catch (e) { setError(e.message); }
  }, [sessionId]);

  // Polling fallback / warm fetch
  useEffect(() => {
    if (isDetail) refreshDetail(); else refreshList();
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (isDetail) refreshDetail(); else refreshList();
    }, pollMs);
    return () => clearInterval(id);
  }, [isDetail, refreshDetail, refreshList, pollMs]);

  // WebSocket for live increments
  useEffect(() => {
    let stopped = false;
    let reconnectTimer = null;

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/api/admin/bots/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        wsBackoffRef.current = 1000;
        setIsConnected(true);
        const sub = sessionId
          ? { action: 'set_subscriptions', session_ids: [sessionId] }
          : { action: 'set_subscriptions', session_ids: ['*'] };
        try { ws.send(JSON.stringify(sub)); } catch {}
        // Re-fetch a snapshot on (re)connect to backfill any gap.
        if (isDetail) refreshDetail(); else refreshList();
      };

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const { topic, payload } = msg || {};
        if (!payload || topic === 'system') return;

        // Filter to current session (when detail open) — server should already
        // filter but guard against firehose leaks during transitions.
        if (sessionId && payload.session_id && String(payload.session_id) !== String(sessionId)) {
          return;
        }

        if (topic === 'bot.activity.decisions') {
          if (payload.persisted === false) {
            // Throttled / not persisted; still useful for the live ticker.
          }
          setDecisions(prev => {
            const next = [{
              id: `live-${payload.tick_at}-${Math.random()}`,
              tick_at: payload.tick_at,
              current_price: payload.current_price,
              momentum: payload.momentum,
              volatility: payload.volatility,
              pressure_ratio: payload.pressure_ratio,
              bid_ratio: payload.bid_ratio,
              ema_signal: payload.ema_signal,
              market_event: payload.market_event,
              selected_strategy: payload.selected_strategy,
              strategy_switched: payload.strategy_switched,
              signals_count: payload.signals_count || 0,
              signal_summary: payload.signal_summary,
              position_side: payload.position_side,
              entry_price: payload.entry_price,
              daily_pnl: payload.daily_pnl,
            }, ...prev];
            return next.slice(0, 200);
          });
        } else if (topic === 'bot.activity.events' || topic === 'bot.activity.lifecycle') {
          setEvents(prev => {
            const next = [{
              id: `live-${payload.created_at}-${Math.random()}`,
              created_at: payload.created_at,
              severity: payload.severity,
              event_type: payload.event_type,
              message: payload.message,
              context: payload.context,
              admin_user: payload.admin_user,
            }, ...prev];
            return next.slice(0, 200);
          });
          // Lifecycle event → refresh status/summary so cards update fast.
          if (topic === 'bot.activity.lifecycle') {
            if (isDetail) refreshDetail(); else refreshList();
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (stopped) return;
        const delay = Math.min(wsBackoffRef.current, 15000);
        wsBackoffRef.current = Math.min(wsBackoffRef.current * 2, 15000);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      if (ws) {
        try { ws.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [isDetail, sessionId, refreshDetail, refreshList]);

  const sendCommand = useCallback(async (action, body) => {
    if (!sessionId) throw new Error('No session selected');
    const res = await api(`/bots/${sessionId}/${action}`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : '{}',
    });
    await refreshDetail();
    return res;
  }, [sessionId, refreshDetail]);

  return {
    list, summary, holdings, equity, trades, decisions, events,
    metrics, globalMetrics, error, isConnected,
    refresh: isDetail ? refreshDetail : refreshList,
    sendCommand,
  };
}

// ── modal ──

function ConfirmModal({ title, description, confirmLabel = 'Confirm', confirmTone = 'accent', onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirmCls = confirmTone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-[#d9774a] hover:bg-[#c56a3d]';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-6 w-full max-w-sm flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-black italic tracking-tighter text-gray-900 dark:text-gray-100 text-xl leading-none">{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 h-10 rounded-lg text-white text-sm font-bold transition-colors ${confirmCls}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── list view ──

function BotListView({ stream, onSelect, isDark }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirmStopAll, setConfirmStopAll] = useState(false);
  const [stopAllError, setStopAllError] = useState('');

  const filtered = useMemo(() => {
    const items = stream.list.items || [];
    return items.filter(item => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!item.user_id?.toLowerCase().includes(s) && !item.symbol?.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [stream.list.items, statusFilter, search]);

  const runningCount = stream.globalMetrics?.running_count ?? 0;
  const totalErrors = stream.globalMetrics?.errors_last_24h ?? 0;

  async function handleStopAll() {
    setStopAllError('');
    try {
      const res = await api('/bots/stop-all', { method: 'POST' });
      setConfirmStopAll(false);
      stream.refresh();
    } catch (e) {
      setStopAllError(e.message);
      setConfirmStopAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {stream.error && <Banner variant="error">{stream.error}</Banner>}

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Bot}
          label="Running bots"
          value={number(stream.globalMetrics?.running_count)}
          detail={`${number(stream.list.total)} total sessions`}
        />
        <StatCard
          icon={Activity}
          label="Total open trades"
          value={number(stream.globalMetrics?.total_open_trades)}
        />
      </div>

      <Panel
        title="All bot sessions"
        action={
          <div className="flex items-center gap-2">
            <select
              className="h-8 px-2 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="halted">Halted</option>
              <option value="deactivated">Deactivated</option>
              <option value="error">Error</option>
            </select>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="user / symbol"
                className="h-8 pl-7 pr-2 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 w-44"
              />
            </div>
            <button
              onClick={stream.refresh}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setConfirmStopAll(true)}
              disabled={runningCount === 0}
              className="h-8 px-3 flex items-center gap-1.5 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
              title={runningCount === 0 ? 'No running bots' : `Stop all ${runningCount} running bot(s)`}
            >
              <Square size={13} />
              Stop All {runningCount > 0 && <span className="bg-red-800 rounded px-1">{runningCount}</span>}
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Symbol</Th>
                <Th>Status</Th>
                <Th>Strategy</Th>
                <Th>Position</Th>
                <Th>P&L today</Th>
                <Th>Trades</Th>
                <Th>Win rate</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600 italic font-mono">No bot sessions match the current filters</td></tr>
              ) : filtered.map(item => (
                <tr key={item.session_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" onClick={() => onSelect(item.session_id)}>
                  <Td className="font-mono">{item.user_id}</Td>
                  <Td className="font-mono font-bold">{item.symbol}</Td>
                  <Td><StatusPill state={botStateOf(item)} /></Td>
                  <Td className="font-mono text-xs">{item.current_strategy || '—'}</Td>
                  <Td>{item.position_side ? `${item.position_side} ${number(item.entry_quantity)} @ ${money(item.entry_price)}` : '—'}</Td>
                  <Td className={`font-bold ${pnlClass(item.daily_pnl)}`}>{money(item.daily_pnl)}</Td>
                  <Td>{number(item.open_trades)} <span className="text-gray-400">open</span></Td>
                  <Td>{(item.win_rate * 100).toFixed(1)}%</Td>
                  <Td><span className="text-[#d9774a] text-xs font-bold">View →</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {stopAllError && <Banner variant="error">Stop All failed: {stopAllError}</Banner>}

      {confirmStopAll && (
        <ConfirmModal
          title="Stop all running bots?"
          description={`This will immediately cancel all ${runningCount} running bot task(s) and mark their sessions as deactivated. Open positions are left untouched.`}
          confirmLabel="Stop All"
          confirmTone="danger"
          onClose={() => setConfirmStopAll(false)}
          onConfirm={handleStopAll}
        />
      )}
    </div>
  );
}

// ── detail view ──

function BotDetailView({ sessionId, onBack, isDark }) {
  const stream = useBotStream({ sessionId });
  const [tab, setTab] = useState('history');
  const [confirm, setConfirm] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const decisionsRef = useRef(null);
  const [commandError, setCommandError] = useState('');

  useEffect(() => {
    if (!autoScroll) return;
    const el = decisionsRef.current;
    if (el) el.scrollTop = 0;  // newest at top
  }, [stream.decisions, autoScroll]);

  async function runCommand(action, body) {
    setCommandError('');
    try {
      await stream.sendCommand(action, body);
    } catch (e) {
      setCommandError(e.message);
    }
    setConfirm(null);
  }

  const summary = stream.summary;
  const state = botStateOf(summary);
  const metrics = stream.metrics;
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9ca3af' : '#6b7280';

  const allocation = useMemo(() => {
    // Aggregate trade volume per symbol to drive the pie chart
    const groups = {};
    for (const t of stream.trades) {
      const k = t.symbol || '—';
      const value = Number(t.quantity || 0) * Number(t.price || 0);
      groups[k] = (groups[k] || 0) + Math.abs(value);
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));
  }, [stream.trades]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="h-9 px-3 flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-bold leading-none">
              {summary?.user_id || '…'} · {summary?.symbol || ''}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusPill state={state} size="lg" />
              {!stream.isConnected && <Pill variant="neutral">OFFLINE</Pill>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => runCommand('start')}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            disabled={!summary || summary.is_running}
          >
            <Play size={14} /> Start
          </button>
          <button
            onClick={() => setConfirm({ action: 'stop', title: 'Stop bot?', tone: 'danger',
              description: 'The bot will stop ticking immediately. Any open positions are left untouched.' })}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
            disabled={!summary || !summary.is_running}
          >
            <Square size={14} /> Stop
          </button>
          <button
            onClick={() => setConfirm({ action: 'restart', title: 'Restart bot?', tone: 'accent',
              description: 'The bot task is bounced. Open positions remain unless you confirm close-positions separately.' })}
            className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-[#d9774a] hover:bg-[#c56a3d] text-white text-xs font-bold transition-colors"
          >
            <RotateCcw size={14} /> Restart
          </button>
          {summary?.status === 'paused' ? (
            <button onClick={() => runCommand('resume')} className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Play size={14} /> Resume
            </button>
          ) : (
            <button onClick={() => runCommand('pause')} className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" disabled={!summary || !summary.is_running}>
              <Pause size={14} /> Pause
            </button>
          )}
          <button
            onClick={stream.refresh}
            className="h-9 w-9 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {stream.error && <Banner variant="error">{stream.error}</Banner>}
      {commandError && <Banner variant="error">Command failed: {commandError}</Banner>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-start gap-3">
          <Bot size={20} className="text-[#d9774a] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Status</p>
            <StatusPill state={state} />
            <span className="text-xs text-gray-400 dark:text-gray-500 block mt-1">
              {summary?.last_decision_at ? `updated ${fmtRelative(summary.last_decision_at)}` : 'no ticks yet'}
            </span>
          </div>
        </div>
        <StatCard
          icon={Wallet}
          label="Strategy"
          value={summary?.current_strategy || '—'}
          detail={summary?.position_side ? `${summary.position_side} ${number(summary?.entry_quantity)} @ ${money(summary?.entry_price)}` : 'No open position'}
        />
        <StatCard
          icon={Activity}
          label="Open Trades"
          value={number(metrics?.trades_open ?? summary?.open_trades)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <Panel
            title="Live decisions"
            action={
              <button
                onClick={() => setAutoScroll(s => !s)}
                className={`h-8 px-2.5 text-[10px] uppercase tracking-wider font-bold rounded-md transition-colors ${autoScroll
                  ? 'bg-[#ebdbd3] dark:bg-[#3d2e26] text-[#d9774a]'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-500'}`}
              >
                <Brain size={12} className="inline mr-1" /> Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
              </button>
            }
          >
            <div ref={decisionsRef} className="h-72 overflow-y-auto p-3 space-y-2">
              {stream.decisions.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic font-mono p-4 text-center">No decisions yet</p>
              ) : stream.decisions.map(d => (
                <div key={d.id} className="text-xs border border-gray-100 dark:border-gray-700/60 rounded-md p-2 bg-gray-50/50 dark:bg-[#1a1a1a]/40">
                  <div className="flex items-center justify-between font-mono text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                    <span>{fmtTime(d.tick_at)}</span>
                    <span className="text-[#d9774a] font-bold">{d.selected_strategy}{d.strategy_switched ? ' ⇄' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] text-gray-600 dark:text-gray-400">
                    {d.current_price != null && <span>px {Number(d.current_price).toFixed(2)}</span>}
                    {d.momentum != null && <span>mom {Number(d.momentum).toFixed(2)}</span>}
                    {d.volatility != null && <span>vol {(Number(d.volatility) * 100).toFixed(2)}%</span>}
                    {d.ema_signal && d.ema_signal !== 'NONE' && <span>ema {d.ema_signal}</span>}
                    {d.market_event && <span className="text-amber-600 dark:text-amber-400">evt {d.market_event}</span>}
                  </div>
                  {(d.signals_count > 0 || d.signal_summary) && (
                    <div className="mt-1 text-[11px] font-bold text-gray-700 dark:text-gray-200">→ {d.signal_summary || `${d.signals_count} signal(s)`}</div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-4">
          <Panel title="Symbol allocation">
            <div className="p-4 h-72 flex items-center">
              {allocation.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic font-mono w-full text-center">No trades yet</p>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="h-44 w-44 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocation} innerRadius={28} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                          {allocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip formatter={v => money(v)} contentStyle={{ background: isDark ? '#252525' : '#fff', border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-xs space-y-1.5 flex-1 min-w-0">
                    {allocation.map(item => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{item.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-auto">{money(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-8">
          <Panel
            title="Holdings"
            action={
              summary?.position_side ? (
                <button
                  onClick={() => setConfirm({ action: 'close-positions', title: 'Force-close all positions?', tone: 'danger',
                    description: 'A MARKET order will be placed to close every open position. The bot continues running.' })}
                  className="h-8 px-2.5 text-xs rounded-md border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Force-close all
                </button>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Symbol</Th><Th>Side</Th><Th>Qty</Th><Th>Entry</Th><Th>Mark</Th><Th>uPnL</Th><Th>%</Th>
                  </tr>
                </thead>
                <tbody>
                  {stream.holdings.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600 italic font-mono">No open positions</td></tr>
                  ) : stream.holdings.map((h, i) => (
                    <tr key={i}>
                      <Td className="font-mono font-bold">{h.symbol}</Td>
                      <Td><Pill variant={h.side === 'BUY' ? 'ok' : 'danger'}>{h.side}</Pill></Td>
                      <Td>{number(h.quantity)}</Td>
                      <Td>{money(h.entry_price)}</Td>
                      <Td>{h.current_price != null ? money(h.current_price) : '—'}</Td>
                      <Td className={`font-bold ${pnlClass(h.unrealized_pnl)}`}>{h.unrealized_pnl != null ? money(h.unrealized_pnl) : '—'}</Td>
                      <Td className={pnlClass(h.unrealized_pct)}>{h.unrealized_pct != null ? `${Number(h.unrealized_pct).toFixed(2)}%` : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>


      </div>

      <Panel
        title={tab === 'history' ? 'Trade history' : tab === 'actions' ? 'Action stream' : 'Errors & lifecycle'}
        action={
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {['history', 'actions', 'errors'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 h-7 text-xs rounded-md transition-colors ${tab === t
                  ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                {t === 'history' ? 'Trade history' : t === 'actions' ? 'Action stream' : 'Errors'}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'history' && <TradeHistoryTable rows={stream.trades} />}
        {tab === 'actions' && <ActionStreamTable rows={stream.events.filter(e => ['ORDER_PLACED', 'ORDER_REJECTED', 'STRATEGY_SWITCH', 'BOT_STARTED', 'ADMIN_START', 'ADMIN_STOP', 'ADMIN_RESTART', 'ADMIN_PAUSE', 'ADMIN_RESUME', 'ADMIN_CLOSE_POSITIONS'].includes(e.event_type))} />}
        {tab === 'errors' && <ErrorLogTable rows={stream.events.filter(e => ['ERROR', 'CRITICAL', 'WARNING'].includes(e.severity))} />}
      </Panel>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.action === 'close-positions' ? 'Close all' : confirm.action === 'restart' ? 'Restart' : 'Stop'}
          confirmTone={confirm.tone}
          onClose={() => setConfirm(null)}
          onConfirm={() => runCommand(confirm.action, confirm.action === 'restart' ? { close_positions: false } : null)}
        />
      )}
    </div>
  );
}

function TradeHistoryTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <Th>Time</Th><Th>Symbol</Th><Th>Side</Th><Th>Qty</Th><Th>Price</Th><Th>Status</Th><Th>P&L</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600 italic font-mono">No trades yet</td></tr>
          ) : rows.map(t => (
            <tr key={t.id}>
              <Td className="font-mono text-xs">{fmtTime(t.created_at)}</Td>
              <Td className="font-mono font-bold">{t.symbol}</Td>
              <Td><Pill variant={t.side === 'BUY' ? 'ok' : 'danger'}>{t.side}</Pill></Td>
              <Td>{number(t.quantity)}</Td>
              <Td>{money(t.price)}</Td>
              <Td><Pill variant={t.status === 'closed' ? 'ok' : t.status === 'cancelled' ? 'danger' : 'neutral'}>{t.status}</Pill></Td>
              <Td className={`font-bold ${pnlClass(t.pnl)}`}>{t.pnl != null ? money(t.pnl) : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionStreamTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr><Th>Time</Th><Th>Event</Th><Th>Message</Th><Th>Admin</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600 italic font-mono">No actions yet</td></tr>
          ) : rows.map(e => (
            <tr key={e.id}>
              <Td className="font-mono text-xs">{fmtTime(e.created_at)}</Td>
              <Td><Pill variant={e.severity === 'ERROR' ? 'danger' : e.severity === 'WARNING' ? 'neutral' : 'ok'}>{e.event_type}</Pill></Td>
              <Td className="text-xs">{e.message}</Td>
              <Td className="font-mono text-xs text-gray-500">{e.admin_user || '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorLogTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr><Th>Time</Th><Th>Severity</Th><Th>Event</Th><Th>Message</Th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400 dark:text-gray-600 italic font-mono">No errors or warnings</td></tr>
          ) : rows.map(e => (
            <tr key={e.id}>
              <Td className="font-mono text-xs">{fmtTime(e.created_at)}</Td>
              <Td><Pill variant={e.severity === 'ERROR' || e.severity === 'CRITICAL' ? 'danger' : 'neutral'}>{e.severity}</Pill></Td>
              <Td className="font-mono text-xs">{e.event_type}</Td>
              <Td className="text-xs whitespace-normal">{e.message}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BotService({ isDark }) {
  const [selected, setSelected] = useState(null);
  const listStream = useBotStream({ sessionId: null });

  if (selected) {
    return <BotDetailView sessionId={selected} onBack={() => setSelected(null)} isDark={isDark} />;
  }
  return <BotListView stream={listStream} onSelect={setSelected} isDark={isDark} />;
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
          {page === 'bot' && <BotService isDark={isDark} />}
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
