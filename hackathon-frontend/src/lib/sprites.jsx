// Icon pixel ve bang cac o vuong (rect) - khong dung anh ngoai.
// cells: mang [x, y, color, width=1, height=1]

function Pixels({ w, h, cells, unit = 4 }) {
  return (
    <svg
      width={w * unit}
      height={h * unit}
      viewBox={`0 0 ${w} ${h}`}
      style={{ shapeRendering: "crispEdges", display: "block" }}
      aria-hidden="true"
    >
      {cells.map((c, i) => (
        <rect key={i} x={c[0]} y={c[1]} width={c[3] || 1} height={c[4] || 1} fill={c[2]} />
      ))}
    </svg>
  );
}

const K = "#000";

export function Flag({ u = 4 }) {
  return <Pixels u={u} unit={u} w={9} h={8} cells={[
    [1,0,K,1,7],
    [2,0,"#edeaf5",2,1],[4,0,K,2,1],[6,0,"#edeaf5",2,1],
    [2,1,K,2,1],[4,1,"#edeaf5",2,1],[6,1,K,2,1],
    [2,2,"#edeaf5",2,1],[4,2,K,2,1],[6,2,"#edeaf5",2,1],
    [2,3,K,2,1],[4,3,"#edeaf5",2,1],[6,3,K,2,1],
  ]} />;
}

export function CarRun({ u = 3 }) {
  return <Pixels unit={u} w={11} h={7} cells={[
    [3,0,"#ff2e88",5,1],
    [2,1,"#ff2e88",7,1],
    [1,2,K,9,1],
    [0,3,"#37e6ff",1,1],[1,3,"#ff5aa2",9,1],[10,3,"#37e6ff",1,1],
    [1,4,K,9,1],
    [2,5,"#111",1,2],[8,5,"#111",1,2],
    [1,5,"#ffcf3a",1,1],[9,5,"#ffcf3a",1,1],
  ]} />;
}

export function CarIdle({ u = 3 }) {
  return <Pixels unit={u} w={11} h={7} cells={[
    [3,0,"#3ff07a",5,1],[2,1,"#3ff07a",7,1],[1,2,K,9,1],
    [1,3,"#8ff5b4",9,1],[1,4,K,9,1],[2,5,"#111",1,2],[8,5,"#111",1,2],
  ]} />;
}

export function Trophy({ u = 3 }) {
  return <Pixels unit={u} w={9} h={9} cells={[
    [2,0,"#ffcf3a",5,1],
    [1,1,"#ffcf3a",7,1],[1,2,"#ffcf3a",7,1],
    [0,1,"#ffcf3a",1,2],[8,1,"#ffcf3a",1,2],
    [2,3,"#ffcf3a",5,1],[3,4,"#ffcf3a",3,1],
    [4,5,"#ffcf3a",1,2],
    [2,7,"#a8791a",5,1],[1,8,"#a8791a",7,1],
  ]} />;
}

export function TrafficLight({ u = 3 }) {
  return <Pixels unit={u} w={7} h={11} cells={[
    [1,0,K,5,11],
    [2,1,"#ff4d5e",3,3],
    [2,4,"#ffcf3a",3,3],
    [2,7,"#3ff07a",3,3],
  ]} />;
}

export function Signal({ u = 3 }) {
  return <Pixels unit={u} w={9} h={8} cells={[
    [0,6,"#2563eb",2,2],
    [3,4,"#2563eb",2,4],
    [6,1,"#2563eb",2,7],
  ]} />;
}

export function User({ u = 3 }) {
  return <Pixels unit={u} w={8} h={8} cells={[
    [3,0,"#8b84ad",2,1],[2,1,"#8b84ad",4,1],[2,2,"#8b84ad",4,1],[3,3,"#8b84ad",2,1],
    [2,5,"#8b84ad",4,1],[1,6,"#8b84ad",6,2],
  ]} />;
}
