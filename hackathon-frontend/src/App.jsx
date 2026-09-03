import { useAuth } from "./hooks/useAuth";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";

export default function App() {
  const { session, loginLive, logout } = useAuth();
  return session
    ? <Dashboard session={session} onLogout={logout} />
    : <LoginScreen onLogin={loginLive} />;
}
