import { useAuth } from "./hooks/useAuth";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import PopoutView from "./components/PopoutView";
import BackendGate from "./components/BackendGate";

// Cửa sổ được tách ra (lib/desktop.js#openPopout) tải lại app này với
// ?popout=<sourceId> trên URL — nhận diện sớm ở đây để render đúng một nguồn
// duy nhất, toàn màn hình, thay vì toàn bộ Dashboard.
function popoutSourceId() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("popout");
}

export default function App() {
  const { session, loginLive, logout } = useAuth();
  const popoutId = popoutSourceId();

  if (popoutId) return <PopoutView sourceId={popoutId} />;

  return (
    <BackendGate>
      {session
        ? <Dashboard session={session} onLogout={logout} />
        : <LoginScreen onLogin={loginLive} />}
    </BackendGate>
  );
}
