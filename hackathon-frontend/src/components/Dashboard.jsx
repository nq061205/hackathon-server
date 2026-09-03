import { useCallback, useMemo, useState } from "react";
import { useRaceData } from "../hooks/useRaceData";
import { useI18n } from "../i18n/I18nContext";
import { makeClient } from "../lib/api";
import Sidebar from "./Sidebar";
import RaceHeader from "./RaceHeader";
import RaceConditions from "./RaceConditions";
import SessionStats from "./SessionStats";
import LiveLog from "./LiveLog";
import RaceTrack from "./RaceTrack";
import Leaderboard from "./Leaderboard";
import LiveTiming from "./LiveTiming";
import NetworkView from "./NetworkView";
import LogsExplorer from "./LogsExplorer";
import ProjectorView from "./ProjectorView";
import AdminConsole from "./AdminConsole";
import TimingTower from "./TimingTower";
import RaceControl from "./RaceControl";
import Incidents from "./Incidents";
import WinProbability from "./WinProbability";

export default function Dashboard({ session, onLogout }) {
  const { t } = useI18n();
  const onUnauthorized = useCallback(() => onLogout(), [onLogout]);
  const { data, online, selRun, setSelRun, refresh } = useRaceData(session, { onUnauthorized });

  const isAdmin = session.mode === "live" && session.role === "admin";
  const client = useMemo(
    () => (session.mode === "live" ? makeClient(session.api, session.token) : null),
    [session]
  );

  const tabs = ["overview", "timing", "network", "logs", "screen", ...(isAdmin ? ["admin"] : [])];
  const [tab, setTab] = useState("overview");
  const [sideHidden, setSideHidden] = useState(false);
  const active = tabs.includes(tab) ? tab : "overview";

  return (
    <div className={`app ${sideHidden ? "side-hidden" : ""}`}>
      <Sidebar
        session={session} online={online} tabs={tabs} active={active}
        onSelect={setTab} onLogout={onLogout} data={data}
      />

      <div className="main">
        {active !== "screen" && active !== "admin" && <RaceHeader data={data} online={online} />}

        {active === "overview" && (
          <>
            <RaceConditions data={data} sideHidden={sideHidden} onToggleSide={() => setSideHidden((v) => !v)} />
            <div className="split">
              <main className="bc-main">
                <RaceTrack data={data} selRun={selRun} onSelect={setSelRun} />
              </main>
              <aside className="split-side">
                <TimingTower data={data} selRun={selRun} onSelect={setSelRun} />
              </aside>
            </div>
            <div className="trio">
              <RaceControl data={data} />
              <LiveLog data={data} selRun={selRun} />
              <Incidents data={data} />
            </div>
            <div className="duo">
              <Leaderboard board={data.board} simple />
              <WinProbability data={data} />
            </div>
          </>
        )}

        {active === "timing" && (
          <>
            <SessionStats data={data} strip />
            <LiveTiming data={data} selRun={selRun} onSelect={setSelRun} />
          </>
        )}
        {active === "network" && (
          <>
            <SessionStats data={data} strip />
            <NetworkView data={data} />
          </>
        )}
        {active === "logs" && <LogsExplorer data={data} client={client} selRun={selRun} />}
        {active === "screen" && <ProjectorView data={data} selRun={selRun} onSelect={setSelRun} />}
        {active === "admin" && isAdmin && (
          <AdminConsole data={data} client={client} refresh={refresh} onUnauthorized={onUnauthorized} />
        )}

        <div className="foot">
          {t("foot")} · <b>WPA2-Enterprise / RADIUS</b> · {t("foot.role")}
        </div>
      </div>
    </div>
  );
}
