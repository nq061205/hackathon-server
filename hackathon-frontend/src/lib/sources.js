// Danh mục "nguồn" cho bộ chuyển cảnh (Switcher) kiểu vMix/TriCaster.
// Mỗi nguồn = một component có sẵn trong Dashboard, chỉ gắn thêm nhãn/icon để
// hiển thị trong lưới multiviewer. Không tạo component mới — dùng lại y nguyên
// để mọi nơi (tab cũ, ô xem trước, cửa sổ tách riêng) luôn khớp dữ liệu.

import RaceTrack from "../components/RaceTrack";
import TimingTower from "../components/TimingTower";
import Leaderboard from "../components/Leaderboard";
import LiveLog from "../components/LiveLog";
import NetworkView from "../components/NetworkView";
import RaceControl from "../components/RaceControl";
import Incidents from "../components/Incidents";
import WinProbability from "../components/WinProbability";

export const SOURCES = [
  {
    id: "track",
    labelKey: "src.track",
    icon: "🗺",
    Component: RaceTrack,
    props: (ctx) => ({ data: ctx.data, selRun: ctx.selRun, onSelect: ctx.onSelect }),
  },
  {
    id: "timing",
    labelKey: "src.timing",
    icon: "⏱",
    Component: TimingTower,
    props: (ctx) => ({ data: ctx.data, selRun: ctx.selRun, onSelect: ctx.onSelect }),
  },
  {
    id: "board",
    labelKey: "src.board",
    icon: "🏆",
    Component: Leaderboard,
    props: (ctx) => ({ board: ctx.data.board }),
  },
  {
    id: "log",
    labelKey: "src.log",
    icon: "📟",
    Component: LiveLog,
    props: (ctx) => ({ data: ctx.data, selRun: ctx.selRun }),
  },
  {
    id: "network",
    labelKey: "src.network",
    icon: "📶",
    Component: NetworkView,
    props: (ctx) => ({ data: ctx.data }),
  },
  {
    id: "control",
    labelKey: "src.control",
    icon: "⚑",
    Component: RaceControl,
    props: (ctx) => ({ data: ctx.data }),
  },
  {
    id: "incidents",
    labelKey: "src.incidents",
    icon: "⚠",
    Component: Incidents,
    props: (ctx) => ({ data: ctx.data }),
  },
  {
    id: "winprob",
    labelKey: "src.winprob",
    icon: "📈",
    Component: WinProbability,
    props: (ctx) => ({ data: ctx.data }),
  },
];

export function findSource(id) {
  return SOURCES.find((s) => s.id === id) || SOURCES[0];
}
