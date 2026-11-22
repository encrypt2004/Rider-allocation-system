import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import api from "./api.js";

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const body = mode === "register" ? { name, email, password } : { email, password };
      const response = await api.post(endpoint, body);
      localStorage.setItem("token", response.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">SR</div>
        <p className="eyebrow">SMART RIDER ALLOCATION</p>
        <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="muted">{mode === "register" ? "Register to explore the delivery operations demo." : "Log in to your delivery operations dashboard."}</p>
        <form onSubmit={submit}>
          {mode === "register" && <label>Your name<input placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} required /></label>}
          <label>Email address<input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" disabled={loading}>{loading ? "Please wait..." : mode === "register" ? "Create account" : "Log in"}</button>
        </form>
        <p className="auth-switch">{mode === "register" ? "Already have an account? " : "New to the demo? "}<Link to={mode === "register" ? "/login" : "/register"}>{mode === "register" ? "Log in" : "Create account"}</Link></p>
      </section>
    </main>
  );
}

const initialRiders = [
  { id: "R-01", name: "Aarav", x: 18, y: 26, status: "Available", task: "Waiting for order", step: 0 },
  { id: "R-02", name: "Ishita", x: 70, y: 20, status: "Delivering", task: "Order #1042", step: 1 },
  { id: "R-03", name: "Kabir", x: 42, y: 66, status: "Available", task: "Waiting for order", step: 2 },
  { id: "R-04", name: "Meera", x: 82, y: 72, status: "Delivering", task: "Order #1040", step: 3 },
  { id: "R-05", name: "Dev", x: 28, y: 82, status: "Offline", task: "Not on shift", step: 4 }
];

const initialOrders = [
  { id: "#1043", customer: "Riya Sharma", restaurant: "Spice Route", status: "Waiting", rider: "—" },
  { id: "#1042", customer: "Arjun Das", restaurant: "Burger Point", status: "On the way", rider: "Ishita" },
  { id: "#1041", customer: "Neha Singh", restaurant: "Green Bowl", status: "Waiting", rider: "—" },
  { id: "#1040", customer: "Kunal Roy", restaurant: "Pizza Hub", status: "On the way", rider: "Meera" }
];

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [riders, setRiders] = useState(initialRiders);
  const [orders, setOrders] = useState(initialOrders);
  const [activity, setActivity] = useState(["Simulation ready. Start the demo to move riders."]);

  useEffect(() => {
    api.get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setAuthError("Your session has expired. Please log in again.");
      });
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
      setRiders((current) => current.map((rider) => {
        if (rider.status === "Offline") return rider;
        const angle = (Date.now() / 1100 + rider.step * 1.7);
        return {
          ...rider,
          x: Math.min(88, Math.max(10, rider.x + Math.sin(angle) * 1.8)),
          y: Math.min(88, Math.max(12, rider.y + Math.cos(angle * 0.8) * 1.5))
        };
      }));
    }, 1100);
    return () => window.clearInterval(timer);
  }, [running]);

  const availableCount = riders.filter((r) => r.status === "Available").length;
  const activeCount = riders.filter((r) => r.status === "Delivering").length;
  const waitingCount = orders.filter((o) => o.status === "Waiting").length;
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const allocateOrder = () => {
    const order = orders.find((item) => item.status === "Waiting");
    const rider = riders.find((item) => item.status === "Available");
    if (!order || !rider) {
      setActivity((items) => ["No waiting order or available rider to allocate.", ...items].slice(0, 5));
      return;
    }
    setOrders((items) => items.map((item) => item.id === order.id ? { ...item, status: "Assigned", rider: rider.name } : item));
    setRiders((items) => items.map((item) => item.id === rider.id ? { ...item, status: "Delivering", task: `Order ${order.id}` } : item));
    setActivity((items) => [`${rider.name} assigned to ${order.id} — nearest available rider in this demo.`, ...items].slice(0, 5));
  };

  const resetSimulation = () => {
    setRunning(false);
    setTick(0);
    setRiders(initialRiders);
    setOrders(initialOrders);
    setActivity(["Simulation reset. Ready for a new run."]);
  };

  if (authError) return <main className="auth-page"><section className="auth-card"><p>{authError}</p><Link to="/login">Log in</Link></section></main>;
  if (!user) return <main className="loading-page">Loading your dashboard...</main>;

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">SR</span><div><strong>RiderFlow</strong><small>Delivery operations</small></div></div>
        <div className="topbar-right"><span className="user-chip">{user.name} · {user.role}</span><button className="text-button" onClick={logout}>Log out</button></div>
      </header>

      <section className="content">
        <div className="page-heading">
          <div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Rider allocation dashboard</h1><p className="muted">Monitor riders, orders and the allocation demo in one place.</p></div>
          <span className={running ? "live-pill live" : "live-pill"}><i />{running ? "Simulation running" : "Simulation paused"}</span>
        </div>

        <div className="stats-grid">
          <article className="stat-card"><span>Available riders</span><strong>{availableCount}</strong><small>Ready for allocation</small></article>
          <article className="stat-card"><span>Delivering</span><strong>{activeCount}</strong><small>Currently on an order</small></article>
          <article className="stat-card"><span>Waiting orders</span><strong>{waitingCount}</strong><small>Need a rider</small></article>
          <article className="stat-card"><span>Simulation ticks</span><strong>{tick}</strong><small>Movement updates</small></article>
        </div>

        <div className="main-grid">
          <section className="surface map-panel">
            <div className="section-heading"><div><h2>Live rider map</h2><p className="muted">Illustrative local simulation · not real GPS</p></div><span className="map-tag">DEMO MAP</span></div>
            <div className="map-canvas">
              <div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" /><div className="map-road road-d" />
              <div className="map-block block-a" /><div className="map-block block-b" /><div className="map-block block-c" /><div className="map-block block-d" />
              <div className="map-pin restaurant-pin" style={{ left: "50%", top: "43%" }}><b>R</b><span>Restaurant</span></div>
              <div className="map-pin customer-pin" style={{ left: "76%", top: "48%" }}><b>C</b><span>Customer</span></div>
              {riders.filter((r) => r.status !== "Offline").map((rider) => <div key={rider.id} className={`rider-marker ${rider.status === "Delivering" ? "busy" : ""}`} style={{ left: `${rider.x}%`, top: `${rider.y}%` }} title={`${rider.name} · ${rider.status}`}><span>{rider.name.slice(0, 1)}</span></div>)}
              <div className="map-legend"><span><i className="legend-dot available-dot" />Available</span><span><i className="legend-dot busy-dot" />Delivering</span><span><i className="legend-dot restaurant-dot" />Restaurant</span></div>
            </div>
            <div className="simulation-bar"><div><strong>Simulation controls</strong><small>Start moving riders around the demo map.</small></div><div className="control-buttons"><button className="primary-button compact" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start simulation"}</button><button className="secondary-button compact" onClick={resetSimulation}>Reset</button></div></div>
          </section>

          <section className="surface allocation-panel">
            <div className="section-heading"><div><h2>Allocation</h2><p className="muted">Assign the next waiting order.</p></div></div>
            <div className="allocation-callout"><span className="callout-icon">↗</span><div><strong>Simple nearest-rider demo</strong><p>The demo selects the first available rider. Distance-based scoring will be connected in the next allocation phase.</p></div></div>
            <button className="primary-button full-button" onClick={allocateOrder}>Allocate next order</button>
            <div className="activity-heading">Recent activity</div>
            <ul className="activity-list">{activity.map((item, index) => <li key={index}><span />{item}</li>)}</ul>
          </section>
        </div>

        <div className="bottom-grid">
          <section className="surface table-panel"><div className="section-heading"><div><h2>Rider status</h2><p className="muted">Current rider availability</p></div></div><div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Current task</th></tr></thead><tbody>{riders.map((rider) => <tr key={rider.id}><td><strong>{rider.name}</strong><small>{rider.id}</small></td><td><span className={`status-badge ${rider.status.toLowerCase()}`}>{rider.status}</span></td><td>{rider.task}</td></tr>)}</tbody></table></div></section>
          <section className="surface table-panel"><div className="section-heading"><div><h2>Recent orders</h2><p className="muted">Order allocation overview</p></div></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Rider</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{order.customer}</small></td><td>{order.restaurant}</td><td><span className={`status-badge ${order.status.toLowerCase().replaceAll(" ", "-")}`}>{order.status}</span></td><td>{order.rider}</td></tr>)}</tbody></table></div></section>
        </div>
        <footer className="footer-note">RiderFlow demo · Simulated rider locations are for demonstration only.</footer>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return <Routes><Route path="/" element={<Navigate to="/login" replace />} /><Route path="/login" element={<AuthPage mode="login" />} /><Route path="/register" element={<AuthPage mode="register" />} /><Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
}
