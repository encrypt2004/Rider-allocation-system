import { useEffect, useState } from "react";
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
    <main className="page">
      <section className="panel">
        <h1>Smart Rider Allocation</h1>
        <p>{mode === "register" ? "Create your customer account" : "Log in to your account"}</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {error && <p className="error">{error}</p>}
          <button disabled={loading}>{loading ? "Please wait..." : mode === "register" ? "Register" : "Log in"}</button>
        </form>
        <p>
          {mode === "register" ? "Already registered? " : "New here? "}
          <Link to={mode === "register" ? "/login" : "/register"}>
            {mode === "register" ? "Log in" : "Register"}
          </Link>
        </p>
      </section>
    </main>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/auth/me")
      .then((response) => setUser(response.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setError("Your session has expired. Please log in again.");
      });
  }, []);

  if (error) return <main className="page"><section className="panel"><p>{error}</p><Link to="/login">Log in</Link></section></main>;
  if (!user) return <main className="page">Loading dashboard...</main>;

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <main className="page">
      <section className="panel">
        <h1>Welcome, {user.name}!</h1>
        <p>Logged in as: {user.role}</p>
        <p>Your account is connected to the MERN backend.</p>
        <p>Rider management, order allocation and live tracking will appear here in the next phases.</p>
        <button onClick={logout}>Log out</button>
      </section>
    </main>
  );
}

function ProtectedRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
