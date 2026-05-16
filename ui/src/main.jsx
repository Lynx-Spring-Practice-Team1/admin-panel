import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  CircleDollarSign,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCog,
  Users,
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

const pages = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'fees', label: 'Broker Fee', icon: SlidersHorizontal },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'trading', label: 'Trading', icon: Activity },
];

const money = value =>
  Number(value || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });

const number = value =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

const percent = value => `${(Number(value || 0) * 100).toFixed(3)}%`;

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the status message.
    }
    throw new Error(message);
  }
  return response.json();
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = await api('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <div className="brandLockup">
          <ShieldCheck size={34} />
          <div>
            <h1>Broker Admin</h1>
            <p>Platform operations</p>
          </div>
        </div>
        <label>
          Username
          <input value={username} onChange={event => setUsername(event.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={event => setPassword(event.target.value)}
            type="password"
          />
        </label>
        {error && <p className="errorText">{error}</p>}
        <button className="primaryButton" disabled={loading}>
          {loading ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <section className="statCard">
      <Icon size={20} />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </section>
  );
}

function Panel({ title, children, action }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      setData(await api('/overview'));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const topSymbols = data?.orders?.top_symbols || [];
  const holdings = data?.portfolio?.holdings_by_symbol || [];

  return (
    <>
      {error && <div className="banner error">{error}</div>}
      {data?.errors?.length > 0 && (
        <div className="banner warning">{data.errors.join(' | ')}</div>
      )}
      <div className="statsGrid">
        <StatCard icon={Users} label="Total users" value={number(data?.users?.total)} />
        <StatCard
          icon={UserRoundCog}
          label="Connected users"
          value={number(data?.connections?.connected_users)}
          detail={`${number(data?.connections?.total_connections)} sockets`}
        />
        <StatCard
          icon={BadgeDollarSign}
          label="Fee revenue"
          value={money(data?.orders?.fee_revenue)}
        />
        <StatCard
          icon={CircleDollarSign}
          label="Platform cash"
          value={money(data?.wallet?.total_cash)}
          detail={`${money(data?.wallet?.reserved_cash)} reserved`}
        />
      </div>
      <div className="splitGrid">
        <Panel title="Top traded symbols">
          <div className="chartBox">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topSymbols}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip formatter={value => money(value)} />
                <Bar dataKey="traded_notional" fill="#1f6f78" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Held stock">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Quantity</th>
                <th>Holders</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(0, 8).map(item => (
                <tr key={item.symbol}>
                  <td>{item.symbol}</td>
                  <td>{number(item.quantity)}</td>
                  <td>{number(item.holders)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

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
    } catch (err) {
      setError(err.message);
    }
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/fees', {
        method: 'POST',
        body: JSON.stringify({ platform_fee_rate: Number(rate), reason: reason || null }),
      });
      setReason('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="splitGrid">
      <Panel title="Current broker fee">
        {error && <div className="banner error">{error}</div>}
        <div className="feeSummary">
          <strong>{percent(data?.policy?.platform_fee_rate)}</strong>
          <span>{data?.policy?.formula}</span>
          <span>{data?.policy?.rounding}</span>
          <b>{money(data?.policy?.platform_profit_total)} collected</b>
        </div>
        <form className="formGrid" onSubmit={save}>
          <label>
            Decimal rate
            <input value={rate} onChange={event => setRate(event.target.value)} />
          </label>
          <label>
            Change reason
            <input value={reason} onChange={event => setReason(event.target.value)} />
          </label>
          <button className="primaryButton">Update fee</button>
        </form>
      </Panel>
      <Panel title="Fee history">
        <table>
          <thead>
            <tr>
              <th>Rate</th>
              <th>Changed by</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {(data?.history || []).map(item => (
              <tr key={item.id}>
                <td>{percent(item.platform_fee_rate)}</td>
                <td>{item.changed_by}</td>
                <td>{item.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

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
      setData(await api(`/users?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function openUser(userId) {
    setSelected(await api(`/users/${userId}`));
  }

  async function suspend(userId) {
    const reason = window.prompt('Suspension reason') || null;
    const updated = await api(`/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    setSelected(updated);
    await load();
  }

  async function reactivate(userId) {
    const updated = await api(`/users/${userId}/reactivate`, { method: 'POST' });
    setSelected(updated);
    await load();
  }

  useEffect(() => {
    load();
  }, [status]);

  return (
    <>
      <Panel
        title="Users"
        action={
          <button className="iconButton" onClick={load} aria-label="Refresh users" title="Refresh users">
            <RefreshCw size={17} />
          </button>
        }
      >
        <div className="toolbar">
          <div className="searchBox">
            <Search size={16} />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && load()}
              placeholder="Search username or email"
            />
          </div>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="secondaryButton" onClick={load}>Search</button>
        </div>
        {error && <div className="banner error">{error}</div>}
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Email</th>
              <th>Status</th>
              <th>Connection</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(user => (
              <tr key={user.id} onClick={() => openUser(user.id)} className="clickRow">
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.email}</td>
                <td>
                  <span className={user.is_suspended ? 'pill danger' : 'pill ok'}>
                    {user.is_suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td>
                  <span className={user.is_connected ? 'pill ok' : 'pill neutral'}>
                    {user.is_connected ? 'Connected' : 'Offline'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {selected && (
        <aside className="drawer">
          <button className="drawerClose" onClick={() => setSelected(null)}>Close</button>
          <h2>{selected.username}</h2>
          <p>{selected.email}</p>
          <div className="drawerFacts">
            <span>ID {selected.id}</span>
            <span>{selected.is_connected ? 'Connected' : 'Offline'}</span>
            <span>{selected.is_suspended ? 'Suspended' : 'Active'}</span>
          </div>
          {selected.suspension_reason && <p className="note">{selected.suspension_reason}</p>}
          {selected.is_suspended ? (
            <button className="primaryButton" onClick={() => reactivate(selected.id)}>Reactivate</button>
          ) : (
            <button className="dangerButton" onClick={() => suspend(selected.id)}>Suspend</button>
          )}
        </aside>
      )}
    </>
  );
}

function Trading() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/trading').then(setData).catch(() => setData({ errors: ['Unable to load trading data'] }));
  }, []);

  const statuses = data?.orders?.status_breakdown || [];
  const symbols = data?.orders?.top_symbols || [];
  const holdings = data?.portfolio?.holdings_by_symbol || [];

  return (
    <div className="splitGrid">
      <Panel title="Order status">
        <table>
          <tbody>
            {statuses.map(item => (
              <tr key={item.status}>
                <td>{item.status}</td>
                <td>{number(item.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Bought and sold">
        <div className="statsGrid compact">
          <StatCard icon={Activity} label="Bought" value={number(data?.orders?.bought_quantity)} />
          <StatCard icon={Activity} label="Sold" value={number(data?.orders?.sold_quantity)} />
          <StatCard icon={BadgeDollarSign} label="Notional" value={money(data?.orders?.traded_notional)} />
        </div>
      </Panel>
      <Panel title="Symbol activity">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Filled qty</th>
              <th>Notional</th>
              <th>Fee</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map(item => (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>{number(item.quantity)}</td>
                <td>{money(item.traded_notional)}</td>
                <td>{money(item.platform_fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Current holdings">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Held qty</th>
              <th>Holders</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map(item => (
              <tr key={item.symbol}>
                <td>{item.symbol}</td>
                <td>{number(item.quantity)}</td>
                <td>{number(item.holders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function AdminApp({ session, onLogout }) {
  const [page, setPage] = useState('overview');
  const activePage = useMemo(() => pages.find(item => item.id === page), [page]);

  async function logout() {
    await api('/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="adminShell">
      <aside className="sidebar">
        <div className="brandLockup small">
          <ShieldCheck size={26} />
          <div>
            <h1>Broker</h1>
            <p>Admin</p>
          </div>
        </div>
        <nav>
          {pages.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <p>Admin panel</p>
            <h1>{activePage?.label}</h1>
          </div>
          <button className="secondaryButton" onClick={logout}>
            <LogOut size={16} />
            {session.username}
          </button>
        </header>
        {page === 'overview' && <Overview />}
        {page === 'fees' && <Fees />}
        {page === 'users' && <UsersPage />}
        {page === 'trading' && <Trading />}
      </main>
    </div>
  );
}

function Root() {
  const [session, setSession] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    api('/me')
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return <main className="loading">Loading</main>;
  if (!session) return <Login onLogin={setSession} />;
  return <AdminApp session={session} onLogout={() => setSession(null)} />;
}

createRoot(document.getElementById('root')).render(<Root />);
