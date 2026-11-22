import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import api from "./api.js";
import MapboxMap from "./components/MapboxMap.jsx";

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
  { id: "R-01", name: "Aarav", lat: 23.3448, lng: 85.3090, status: "Available", task: "Waiting for order", step: 0 },
  { id: "R-02", name: "Ishita", lat: 23.3470, lng: 85.3130, status: "Delivering", task: "Order #1042", step: 1 },
  { id: "R-03", name: "Kabir", lat: 23.3415, lng: 85.3110, status: "Available", task: "Waiting for order", step: 2 },
  { id: "R-04", name: "Meera", lat: 23.3425, lng: 85.3160, status: "Delivering", task: "Order #1040", step: 3 },
  { id: "R-05", name: "Dev", lat: 23.3395, lng: 85.3075, status: "Offline", task: "Not on shift", step: 4 }
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
  const [activity, setActivity] = useState(["Connecting to the allocation backend..."]);
  const [allocationDetails, setAllocationDetails] = useState(null);
  const [lifecycleBusy, setLifecycleBusy] = useState("");

  useEffect(() => {
    api.get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setAuthError("Your session has expired. Please log in again.");
      });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let active = true;

    const loadDemoData = async () => {
      await api.post("/demo/setup");
      const response = await api.get("/demo/dashboard");
      if (!active) return;
      setRiders(response.data.riders);
      setOrders(response.data.orders);
    };

    loadDemoData().catch((error) => {
      if (active) {
        setActivity((items) => [
          error.response?.data?.message || "Could not load demo data from the backend.",
          ...items
        ].slice(0, 5));
      }
    });

    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem("token");
    const socketUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\\/api\\/?$/, "");
    const socket = io(socketUrl, { auth: { token } });

    socket.on("dashboard:update", (dashboard) => {
      setRiders(dashboard.riders || []);
      setOrders(dashboard.orders || []);
    });

    socket.on("connect_error", (error) => {
      setActivity((items) => [`Live updates disconnected: ${error.message}`, ...items].slice(0, 5));
    });

    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(async () => {
      try {
        await api.post("/demo/simulation/tick");
        setTick((value) => value + 1);
      } catch (error) {
        setRunning(false);
        setActivity((items) => [
          error.response?.data?.message || "Live simulation stopped because the backend could not update rider locations.",
          ...items
        ].slice(0, 5));
      }
    }, 1100);
    return () => window.clearInterval(timer);
  }, [running]);

  const availableCount = riders.filter((r) => r.status === "Available").length;
  const activeCount = riders.filter((r) => ["Delivering", "Picked up"].includes(r.status)).length;
  const waitingCount = orders.filter((o) => o.status === "PENDING").length;
  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const allocateOrder = async () => {
    try {
      const response = await api.post("/demo/allocate");
      const allocation = response.data.allocation;
      const dashboard = await api.get("/demo/dashboard");
      setRiders(dashboard.data.riders);
      setOrders(dashboard.data.orders);
      setAllocationDetails(allocation);
      setActivity((items) => [
        `${allocation.selectedRider.riderName} assigned to #${allocation.orderNumber} · ${allocation.selectedRider.distanceKm} km · ETA ${allocation.selectedRider.etaMinutes} min.`,
        ...items
      ].slice(0, 5));
    } catch (error) {
      setActivity((items) => [
        error.response?.data?.message || "Could not allocate the next order.",
        ...items
      ].slice(0, 5));
    }
  };

  const advanceOrder = async (order) => {
    const nextStatus = order.status === "ASSIGNED" ? "PICKED_UP" : "DELIVERED";
    const key = order.orderNumber;
    setLifecycleBusy(key);
    try {
      const response = await api.patch(`/demo/orders/${key}/status`, { status: nextStatus });
      setRiders(response.data.dashboard.riders);
      setOrders(response.data.dashboard.orders);
      setActivity((items) => [`Order #${key} moved to ${nextStatus.replace("_", " ")}.`, ...items].slice(0, 5));
    } catch (error) {
      setActivity((items) => [error.response?.data?.message || "Could not update this order.", ...items].slice(0, 5));
    } finally {
      setLifecycleBusy("");
    }
  };

  const resetSimulation = async () => {
    setRunning(false);
    setTick(0);
    try {
      await api.post("/demo/reset");
      const dashboard = await api.get("/demo/dashboard");
      setRiders(dashboard.data.riders);
      setOrders(dashboard.data.orders);
      setAllocationDetails(null);
      setActivity(["Simulation and MongoDB demo data reset. Ready for a new run."]);
    } catch (error) {
      setActivity((items) => [
        error.response?.data?.message || "Could not reset demo data.",
        ...items
      ].slice(0, 5));
    }
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
            <div className="section-heading"><div><h2>Live rider map</h2><p className="muted">Real Mapbox streets · simulated rider coordinates</p></div><span className="map-tag">DEMO MAP</span></div>
            <MapboxMap riders={riders} />
            <div className="simulation-bar"><div><strong>Simulation controls</strong><small>Move simulated riders across the live map.</small></div><div className="control-buttons"><button className="primary-button compact" onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start simulation"}</button><button className="secondary-button compact" onClick={resetSimulation}>Reset</button></div></div>
          </section>

          <section className="surface allocation-panel">
            <div className="section-heading"><div><h2>Allocation</h2><p className="muted">Assign the next waiting order.</p></div></div>
            <div className="allocation-callout"><span className="callout-icon">↗</span><div><strong>H3 + weighted rider scoring</strong><p>The backend searches nearby H3 cells, calculates Haversine distance and estimated arrival time, then ranks available riders.</p></div></div>
            <button className="primary-button full-button" onClick={allocateOrder}>Allocate next order</button>
            <div className="activity-heading">Recent activity</div>
            {allocationDetails && (
              <div className="candidate-results">
                <div className="activity-heading">Allocation decision · Order #{allocationDetails.orderNumber}</div>
                <p className="muted">H3 resolution {allocationDetails.h3.resolution} · rings searched {allocationDetails.h3.ringsChecked} · candidates {allocationDetails.h3.candidateCount}</p>
                <div className="table-wrap"><table><thead><tr><th>Rider</th><th>Distance</th><th>ETA</th><th>Score details</th><th>Total</th></tr></thead><tbody>
                  {allocationDetails.candidates.map((candidate) => (
                    <tr key={candidate.riderId}>
                      <td><strong>{candidate.riderName}</strong>{candidate.riderId === allocationDetails.selectedRider.riderId && <small>Selected</small>}</td>
                      <td>{candidate.distanceKm} km</td>
                      <td>{candidate.etaMinutes} min</td>
                      <td><small>Distance {candidate.scoreBreakdown.distance} · ETA {candidate.scoreBreakdown.eta}<br />Workload {candidate.scoreBreakdown.workload} · Rating {candidate.scoreBreakdown.rating}</small></td><td><strong>{candidate.score}</strong></td>
                    </tr>
                  ))}
                </tbody></table></div>
                <p className="muted">Lower score is better. Score = distance (40%) + ETA (30%) + workload (20%) + rating (10%). Each component is shown above; lower total wins.</p>
              </div>
            )}
            <ul className="activity-list">{activity.map((item, index) => <li key={index}><span />{item}</li>)}</ul>
          </section>
        </div>

        <div className="bottom-grid">
          <section className="surface table-panel"><div className="section-heading"><div><h2>Rider status</h2><p className="muted">Current rider availability</p></div></div><div className="table-wrap"><table><thead><tr><th>Rider</th><th>Status</th><th>Current task</th></tr></thead><tbody>{riders.map((rider) => <tr key={rider.id}><td><strong>{rider.name}</strong><small>{rider.id}</small></td><td><span className={`status-badge ${rider.status.toLowerCase()}`}>{rider.status}</span></td><td>{rider.task}</td></tr>)}</tbody></table></div></section>
          <section className="surface table-panel"><div className="section-heading"><div><h2>Recent orders</h2><p className="muted">Order allocation overview</p></div></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Rider</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{order.customer}</small></td><td>{order.restaurant}</td><td><span className={`status-badge ${order.status.toLowerCase().replaceAll("_", "-")}`}>{order.status.replaceAll("_", " ")}</span></td><td>{order.rider}{["ASSIGNED", "PICKED_UP"].includes(order.status) && <button className="secondary-button compact order-action" disabled={lifecycleBusy === order.orderNumber} onClick={() => advanceOrder(order)}>{lifecycleBusy === order.orderNumber ? "Saving..." : order.status === "ASSIGNED" ? "Mark picked up" : "Mark delivered"}</button>}</td></tr>)}</tbody></table></div></section>
        </div>
        <footer className="footer-note">RiderFlow demo · Rider coordinates are simulated, displayed on a real Mapbox map.</footer>
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
