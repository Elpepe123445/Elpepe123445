import {
  geoAzimuthalEqualArea,
  geoCircle,
  geoGraticule,
  geoMercator,
  geoOrthographic,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  countryById,
  mergeCountries,
  moveOnSphere,
  PaperDefs,
  PaperPiece,
  PaperTag,
  type Feat,
} from "../../components/paper/Paper";
import { inOut, prog, visible } from "../../engine/theme";
import { useCues } from "../../engine/timeline";

/** Paleta de papel: mesa de cartón oscuro, mar azul agua, tierra crema y piezas de color. */
export const P = {
  table: "radial-gradient(ellipse at 50% 40%, #4A3B32 0%, #2A211C 75%)",
  sea: "#8CCBE0",
  seaDeep: "#6FB2CC",
  land: ["#F4E6C8", "#CDB68F"] as const,
  greenland: ["#FF7B6B", "#C24A3D"] as const,
  africa: ["#3DBBA6", "#1F7E6F"] as const,
  russia: ["#9C86F0", "#5E4BB5"] as const,
  antarctica: ["#E8F4FA", "#A9C3D2"] as const,
  usa: ["#FF9F43", "#C46A12"] as const,
  china: ["#FFD34E", "#C99A12"] as const,
  india: ["#FF7EB6", "#C0457E"] as const,
  eu: ["#5B8DEF", "#2E57AE"] as const,
  ink: "#2B2420",
};

const W = 1080;
const SHEET = { x: 40, y: 170, w: 1000, h: 1190 };

const GREENLAND = "304";
const RUSSIA = "643";
const ANTARCTICA = "010";
const EU = [
  "040",
  "056",
  "100",
  "191",
  "196",
  "203",
  "208",
  "233",
  "246",
  "250",
  "276",
  "300",
  "348",
  "372",
  "380",
  "428",
  "440",
  "442",
  "528",
  "616",
  "620",
  "642",
  "703",
  "705",
  "724",
  "752",
];

/** África: países cuyo centro cae en el continente (excluye Oriente Medio y Chipre; incluye Eritrea). */
const isAfrica = (id: string, _n: string, [lon, lat]: [number, number]) =>
  id === "232" ||
  (id !== "196" &&
    lon > -20 &&
    lon < 52 &&
    lat > -36 &&
    lat < 37.5 &&
    !(lon > 34 && lat > 12.5));

/** Piezas fijas del mundo agrupadas por continente (para que "caigan" por separado). */
const useWorld = () =>
  useMemo(() => {
    const special = new Set([GREENLAND, RUSSIA, ANTARCTICA]);
    const groups: [
      string,
      (id: string, n: string, c: [number, number]) => boolean,
    ][] = [
      ["americas", (id, _n, [lon]) => !special.has(id) && lon < -25],
      [
        "europa",
        (id, n, c) =>
          !special.has(id) &&
          !isAfrica(id, n, c) &&
          c[0] >= -25 &&
          c[0] < 45 &&
          c[1] > 34,
      ],
      [
        "asia",
        (id, n, c) =>
          !special.has(id) &&
          !isAfrica(id, n, c) &&
          c[0] >= 25 &&
          !(c[0] < 45 && c[1] > 34) &&
          !(c[0] > 110 && c[1] < -10),
      ],
      [
        "oceania",
        (id, _n, [lon, lat]) => !special.has(id) && lon > 110 && lat < -10,
      ],
    ];
    return {
      groups: groups.map(([k, f]) => ({ key: k, feat: mergeCountries(f) })),
      africa: mergeCountries(isAfrica),
      greenland: countryById(GREENLAND),
      russia: countryById(RUSSIA),
      antarctica: countryById(ANTARCTICA),
      usa: countryById("840"),
      china: countryById("156"),
      india: countryById("356"),
      eu: mergeCountries((id) => EU.includes(id)),
    };
  }, []);

const mercator = (): GeoProjection => {
  const p = geoMercator();
  p.fitExtent(
    [
      [SHEET.x + 20, SHEET.y + 20],
      [SHEET.x + SHEET.w - 20, SHEET.y + SHEET.h - 20],
    ],
    {
      type: "MultiPoint",
      coordinates: [
        [-75, -55],
        [75, 84],
        [-75, 84],
        [75, -55],
      ],
    },
  );
  return p;
};

/** Mesa + hoja de "mar" de papel con pliegues sutiles. */
const Sheet: React.FC<{ children: React.ReactNode; pan?: number }> = ({
  children,
  pan = 0,
}) => (
  <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
    <PaperDefs />
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={P.sea} />
        <stop offset="100%" stopColor={P.seaDeep} />
      </linearGradient>
      <clipPath id="sheetClip">
        <rect
          x={SHEET.x}
          y={SHEET.y}
          width={SHEET.w}
          height={SHEET.h}
          rx={18}
        />
      </clipPath>
    </defs>
    <g filter="url(#paper-shadow-2)">
      <rect
        x={SHEET.x}
        y={SHEET.y}
        width={SHEET.w}
        height={SHEET.h}
        rx={18}
        fill="url(#sea)"
      />
    </g>
    <rect
      x={SHEET.x}
      y={SHEET.y}
      width={SHEET.w}
      height={SHEET.h}
      rx={18}
      fill="url(#paper-grain)"
      opacity={0.18}
      style={{ mixBlendMode: "multiply" }}
    />
    <line
      x1={SHEET.x + SHEET.w / 2}
      y1={SHEET.y}
      x2={SHEET.x + SHEET.w / 2}
      y2={SHEET.y + SHEET.h}
      stroke="#FFFFFF"
      strokeOpacity={0.12}
      strokeWidth={3}
    />
    <line
      x1={SHEET.x}
      y1={SHEET.y + SHEET.h / 2}
      x2={SHEET.x + SHEET.w}
      y2={SHEET.y + SHEET.h / 2}
      stroke="#000000"
      strokeOpacity={0.06}
      strokeWidth={3}
    />
    <g clipPath="url(#sheetClip)">
      <g transform={`translate(0 ${-pan})`}>{children}</g>
    </g>
  </svg>
);

const Graticule: React.FC<{ path: ReturnType<typeof geoPath> }> = ({
  path,
}) => (
  <path
    d={path(geoGraticule().step([15, 15])()) ?? ""}
    fill="none"
    stroke="#FFFFFF"
    strokeOpacity={0.28}
    strokeWidth={1.5}
    strokeDasharray="2 6"
  />
);

const Title: React.FC<{
  text: string;
  o: number;
  sub?: string;
  stamp?: number;
}> = ({ text, o, sub, stamp = 0 }) => (
  <PaperTag x={540} y={95} rotate={-2} opacity={o}>
    <div style={{ fontWeight: 900, fontSize: 50, letterSpacing: "0.02em" }}>
      {text}
    </div>
    {sub ? (
      <div
        style={{
          fontWeight: 600,
          fontSize: 26,
          color: "#7A6A5E",
          marginTop: 4,
        }}
      >
        {sub}
      </div>
    ) : null}
    {stamp > 0 ? (
      <div
        style={{
          position: "absolute",
          right: -30,
          top: -26,
          rotate: "12deg",
          scale: String(2 - stamp),
          opacity: stamp,
          border: "5px solid #D64533",
          color: "#D64533",
          padding: "2px 14px",
          fontWeight: 900,
          fontSize: 34,
          borderRadius: 8,
          background: "rgba(255,253,246,0.85)",
        }}
      >
        MIENTE
      </div>
    ) : null}
  </PaperTag>
);

/** 1 · El mapa se arma pieza a pieza… y miente. */
export const GHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const world = useWorld();
  const proj = useMemo(mercator, []);
  const path = geoPath(proj);
  const pieces: {
    key: string;
    feat: Feat;
    colors: readonly [string, string];
  }[] = [
    ...world.groups.map((g) => ({ key: g.key, feat: g.feat, colors: P.land })),
    { key: "greenland", feat: world.greenland, colors: P.land },
    { key: "russia", feat: world.russia, colors: P.land },
    { key: "africa", feat: world.africa, colors: P.land },
    { key: "antarctica", feat: world.antarctica, colors: P.antarctica },
  ];
  const stamp = spring({
    frame: frame - c.word("g1", "miente"),
    fps,
    config: { damping: 10 },
  });
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet>
        <Graticule path={path} />
        {pieces.map((p, i) => {
          const s = spring({
            frame: frame - 4 - i * 5,
            fps,
            config: { damping: 11, mass: 0.7 },
          });
          const ty = (1 - s) * -700;
          return (
            <g
              key={p.key}
              transform={`translate(0 ${ty}) rotate(${(1 - s) * (i % 2 ? 8 : -8)} 540 700)`}
            >
              <PaperPiece
                d={path(p.feat) ?? ""}
                color={p.colors[0]}
                edge={p.colors[1]}
                lift={1 - s}
              />
            </g>
          );
        })}
      </Sheet>
      <Title
        text="EL MAPA DE TU ESCUELA"
        o={prog(frame, 6, 12)}
        stamp={frame >= c.word("g1", "miente") ? Math.min(1, stamp) : 0}
      />
    </AbsoluteFill>
  );
};

/** Mapa base reutilizado por las escenas 2-4: mundo crema + Groenlandia y África destacables. */
const BaseMap: React.FC<{
  proj: GeoProjection;
  greenland?: { feat: Feat; color: readonly [string, string]; lift: number };
  africa?: { color: readonly [string, string]; lift: number };
  ghost?: Feat;
  children?: React.ReactNode;
}> = ({ proj, greenland, africa, ghost, children }) => {
  const world = useWorld();
  const path = geoPath(proj);
  return (
    <>
      <Graticule path={path} />
      {world.groups.map((g) => (
        <PaperPiece
          key={g.key}
          d={path(g.feat) ?? ""}
          color={P.land[0]}
          edge={P.land[1]}
        />
      ))}
      <PaperPiece
        d={path(world.russia) ?? ""}
        color={P.land[0]}
        edge={P.land[1]}
      />
      <PaperPiece
        d={path(world.antarctica) ?? ""}
        color={P.antarctica[0]}
        edge={P.antarctica[1]}
      />
      <PaperPiece
        d={path(world.africa) ?? ""}
        color={africa?.color[0] ?? P.land[0]}
        edge={africa?.color[1] ?? P.land[1]}
        lift={africa?.lift ?? 0}
      />
      {ghost ? (
        <path
          d={path(ghost) ?? ""}
          fill="none"
          stroke={P.greenland[1]}
          strokeWidth={3}
          strokeDasharray="10 8"
          opacity={0.8}
        />
      ) : null}
      {greenland ? (
        <PaperPiece
          d={path(greenland.feat) ?? ""}
          color={greenland.color[0]}
          edge={greenland.color[1]}
          lift={greenland.lift}
        />
      ) : null}
      {children}
    </>
  );
};

/** 2 · Groenlandia parece tan grande como África… pero África es 14 veces mayor. */
export const GSize: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const world = useWorld();
  const proj = useMemo(mercator, []);
  const path = geoPath(proj);
  const gl = prog(frame, c.word("g2", "groenlandia") - 6, 14);
  const af = prog(frame, c.word("g2", "africa") - 6, 14);
  const x14 = spring({
    frame: frame - c.word("g3", "catorce"),
    fps,
    config: { damping: 10 },
  });
  const [gx, gy] = path.centroid(world.greenland);
  const [ax, ay] = path.centroid(world.africa);
  const afLift = interpolate(
    frame,
    [c.start("g3"), c.start("g3") + 20],
    [0.3, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet>
        <BaseMap
          proj={proj}
          greenland={{
            feat: world.greenland,
            color: gl > 0.5 ? P.greenland : P.land,
            lift: gl * 0.4,
          }}
          africa={{ color: af > 0.5 ? P.africa : P.land, lift: af * afLift }}
        />
      </Sheet>
      <PaperTag x={gx + 150} y={gy + 120} rotate={4} opacity={gl}>
        <div style={{ fontWeight: 900, fontSize: 38 }}>Groenlandia</div>
        <div style={{ fontWeight: 700, fontSize: 30, color: P.greenland[1] }}>
          2,2 M km²
        </div>
      </PaperTag>
      <PaperTag x={ax + 40} y={ay + 40} rotate={-3} opacity={af}>
        <div style={{ fontWeight: 900, fontSize: 38 }}>África</div>
        <div style={{ fontWeight: 700, fontSize: 30, color: P.africa[1] }}>
          30,4 M km²
        </div>
      </PaperTag>
      <PaperTag
        x={540}
        y={1250}
        rotate={-6}
        scale={frame >= c.word("g3", "catorce") ? 0.6 + 0.4 * x14 : 0}
        color="#FFE45C"
      >
        <div style={{ fontWeight: 900, fontSize: 96, lineHeight: 1 }}>× 14</div>
      </PaperTag>
      <Title text="¿DEL MISMO TAMAÑO?" o={visible(frame, 4, c.duration, 10)} />
    </AbsoluteFill>
  );
};

/** 3 · Mercator, 1569: los círculos iguales de Tissot se inflan hacia los polos. */
export const GMercator: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const proj = useMemo(mercator, []);
  const path = geoPath(proj);
  const estirar = c.word("g4", "estirar");
  const lats = [-45, -30, -15, 0, 15, 30, 45, 60, 75];
  const lons = [-60, -30, 0, 30, 60];
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet>
        <BaseMap proj={proj} />
        {lats.flatMap((lat, i) =>
          lons.map((lon, j) => {
            const appear = prog(frame, 20 + i * 4 + j * 2, 14);
            const circle = geoCircle().center([lon, lat]).radius(5.5)();
            return appear > 0 ? (
              <g key={`${lat}${lon}`} opacity={appear}>
                <PaperPiece
                  d={path(circle) ?? ""}
                  color="#FFDD57"
                  edge="#C9A214"
                  thickness={3}
                  lift={0.2}
                />
              </g>
            ) : null;
          }),
        )}
        {frame > estirar - 6
          ? [SHEET.y + 120, SHEET.y + SHEET.h - 110].map((y, k) => (
              <g
                key={k}
                opacity={prog(frame, estirar - 6, 12)}
                transform={`translate(540 ${y + Math.sin(frame / 5) * 8 * (k ? 1 : -1)})`}
              >
                <path
                  d={
                    k ? "M -50 -20 L 0 30 L 50 -20" : "M -50 20 L 0 -30 L 50 20"
                  }
                  fill="none"
                  stroke="#D64533"
                  strokeWidth={14}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))
          : null}
      </Sheet>
      <Title
        text="MERCATOR · 1569"
        sub="perfecto para navegar"
        o={prog(frame, 6, 12)}
      />
      <PaperTag
        x={540}
        y={1250}
        rotate={2}
        opacity={prog(frame, c.word("g4", "navegar"), 14)}
      >
        <div style={{ fontWeight: 800, fontSize: 32 }}>
          En la Tierra, todos estos círculos
        </div>
        <div style={{ fontWeight: 800, fontSize: 32 }}>
          miden exactamente lo mismo
        </div>
      </PaperTag>
    </AbsoluteFill>
  );
};

/** 4 · Groenlandia viaja al ecuador sobre la esfera y se encoge a su tamaño real. */
export const GMove: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const world = useWorld();
  const proj = useMemo(mercator, []);
  const path = geoPath(proj);
  const t = prog(frame, c.word("g5", "ecuador") - 16, 60, inOut);
  const moved = moveOnSphere(world.greenland, [-22, 3], t);
  const [mx, my] = path.centroid(moved);
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet>
        <BaseMap
          proj={proj}
          ghost={world.greenland}
          greenland={{
            feat: moved,
            color: P.greenland,
            lift: 0.4 + 0.6 * Math.sin(Math.PI * t),
          }}
          africa={{ color: P.africa, lift: 0.15 }}
        />
      </Sheet>
      <PaperTag
        x={mx - 10}
        y={my + 110}
        rotate={-4}
        opacity={prog(frame, c.word("g5", "encoge") - 4, 12)}
        color="#FFE45C"
      >
        <div style={{ fontWeight: 900, fontSize: 36 }}>tamaño real</div>
      </PaperTag>
      <Title text="TAMAÑO VERDADERO" o={prog(frame, 6, 12)} />
    </AbsoluteFill>
  );
};

/** 5 · Rusia se encoge junto a África; la Antártida se estira hasta el infinito. */
export const GRussia: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const world = useWorld();
  const proj = useMemo(() => {
    const p = geoMercator().rotate([-70, 0]);
    p.fitExtent(
      [
        [SHEET.x + 20, SHEET.y + 20],
        [SHEET.x + SHEET.w - 20, SHEET.y + SHEET.h - 20],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [5, -45],
          [135, 82],
          [5, 82],
          [135, -45],
        ],
      },
    );
    return p;
  }, []);
  const path = geoPath(proj);
  const t = prog(frame, c.word("g6", "pero") - 10, 60, inOut);
  const moved = moveOnSphere(world.russia, [64, 2], t);
  const anta = c.start("g6b");
  const pan = prog(frame, anta - 6, 50, inOut);
  const infinito = c.word("g6b", "infinito");
  const [rx, ry] = path.centroid(moved);
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet pan={pan * 900}>
        <Graticule path={path} />
        {world.groups.map((g) => (
          <PaperPiece
            key={g.key}
            d={path(g.feat) ?? ""}
            color={P.land[0]}
            edge={P.land[1]}
          />
        ))}
        <PaperPiece
          d={path(world.greenland) ?? ""}
          color={P.land[0]}
          edge={P.land[1]}
        />
        <PaperPiece
          d={path(world.africa) ?? ""}
          color={P.africa[0]}
          edge={P.africa[1]}
          lift={0.2}
        />
        <path
          d={path(world.russia) ?? ""}
          fill="none"
          stroke={P.russia[1]}
          strokeWidth={3}
          strokeDasharray="10 8"
          opacity={t > 0 ? 0.8 : 0}
        />
        <PaperPiece
          d={path(moved) ?? ""}
          color={P.russia[0]}
          edge={P.russia[1]}
          lift={0.3 + 0.6 * Math.sin(Math.PI * t)}
        />
        <PaperPiece
          d={path(world.antarctica) ?? ""}
          color={P.antarctica[0]}
          edge={P.antarctica[1]}
          lift={pan * 0.5}
        />
      </Sheet>
      <PaperTag
        x={rx + 20}
        y={ry - pan * 900 + 10}
        rotate={3}
        opacity={visible(frame, 10, anta, 10)}
      >
        <div style={{ fontWeight: 900, fontSize: 36 }}>Rusia</div>
        <div style={{ fontWeight: 700, fontSize: 28, color: P.russia[1] }}>
          17,1 M km² · África: 30,4
        </div>
      </PaperTag>
      <PaperTag
        x={540}
        y={1150}
        rotate={-3}
        opacity={prog(frame, infinito - 8, 12)}
        color="#E8F4FA"
      >
        <div style={{ fontWeight: 900, fontSize: 40 }}>Antártida</div>
        <div style={{ fontWeight: 700, fontSize: 30, color: "#4A7A93" }}>
          polo sur → ∞
        </div>
      </PaperTag>
      <Title
        text={frame < anta ? "RUSIA vs ÁFRICA" : "LA ANTÁRTIDA NO CABE"}
        o={prog(frame, 6, 12)}
      />
    </AbsoluteFill>
  );
};

/** Áreas oficiales (millones de km²). */
const AREAS = { africa: 30.37, usa: 9.83, china: 9.6, india: 3.29, eu: 4.23 };

/**
 * 6 · En África caben EE. UU., China, India y la UE: África se "llena" por capas cuya superficie
 * es proporcional al área real de cada territorio (proyección de áreas iguales). Lo que queda arriba, sobra.
 */
export const GAfrica: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c = useCues();
  const world = useWorld();
  const proj = useMemo(() => {
    const p = geoAzimuthalEqualArea().rotate([-18, -2]);
    p.fitExtent(
      [
        [SHEET.x + 60, SHEET.y + 70],
        [SHEET.x + SHEET.w - 260, SHEET.y + SHEET.h - 70],
      ],
      world.africa,
    );
    return p;
  }, [world.africa]);
  const path = geoPath(proj);
  const dAfrica = path(world.africa) ?? "";
  // Altura (y) a la que la superficie de África acumulada desde abajo alcanza cada fracción.
  const levelAt = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = 1920;
    const ctx = cv.getContext("2d")!;
    ctx.fill(new Path2D(dAfrica));
    const data = ctx.getImageData(0, 0, W, 1920).data;
    const rows = new Float64Array(1920);
    for (let y = 0; y < 1920; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 127) n++;
      rows[y] = n;
    }
    const total = rows.reduce((s, v) => s + v, 0);
    let lowest = 1919;
    while (lowest > 0 && rows[lowest] === 0) lowest--;
    return (fraction: number) => {
      if (fraction <= 0) return lowest;
      let acc = 0;
      for (let y = 1919; y >= 0; y--) {
        acc += rows[y];
        if (acc / total >= fraction) return y;
      }
      return 0;
    };
  }, [dAfrica]);
  const items = [
    {
      key: "usa",
      label: "EE. UU.",
      area: AREAS.usa,
      colors: P.usa,
      word: "estados",
    },
    {
      key: "china",
      label: "China",
      area: AREAS.china,
      colors: P.china,
      word: "china",
    },
    {
      key: "india",
      label: "India",
      area: AREAS.india,
      colors: P.india,
      word: "india",
    },
    {
      key: "eu",
      label: "Unión Europea",
      area: AREAS.eu,
      colors: P.eu,
      word: "union",
    },
  ];
  const sobra = c.word("g7", "sobra");
  let cum = 0;
  const layers = items.map((it) => {
    const bottom = levelAt(cum / AREAS.africa);
    cum += it.area;
    const top = levelAt(cum / AREAS.africa);
    const at = c.word("g7", it.word);
    const rise = spring({
      frame: frame - at + 2,
      fps,
      config: { damping: 16, mass: 0.6 },
    });
    return { ...it, bottom, top, rise: frame >= at - 2 ? rise : 0, at };
  });
  const bbox = path.bounds(world.africa);
  // Etiquetas en columna, sin pisarse: desde arriba hacia abajo con separación mínima.
  const tagY: number[] = [];
  [...layers.keys()].reverse().forEach((i) => {
    const want = (layers[i].top + layers[i].bottom) / 2;
    const prev = tagY.length
      ? Math.max(...Object.values(tagY).filter((v) => v !== undefined))
      : -Infinity;
    tagY[i] = Math.max(want, prev + 100);
  });
  const left = SHEET.x + 30;
  const leftover = (100 * (AREAS.africa - cum)) / AREAS.africa;
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <Sheet>
        <defs>
          <clipPath id="africaClip">
            <path d={dAfrica} />
          </clipPath>
        </defs>
        <PaperPiece
          d={dAfrica}
          color={P.africa[0]}
          edge={P.africa[1]}
          thickness={8}
          lift={0.35}
        />
        <g clipPath="url(#africaClip)">
          {layers.map((l) => {
            const y = l.bottom - (l.bottom - l.top) * l.rise;
            return l.rise > 0 ? (
              <g key={l.key}>
                <rect
                  x={left}
                  y={y}
                  width={bbox[1][0] - left + 40}
                  height={l.bottom - y + 1}
                  fill={l.colors[0]}
                />
                <rect
                  x={left}
                  y={y}
                  width={bbox[1][0] - left + 40}
                  height={6}
                  fill="#FFFFFF"
                  opacity={0.35}
                />
                <rect
                  x={left}
                  y={y}
                  width={bbox[1][0] - left + 40}
                  height={l.bottom - y + 1}
                  fill="url(#paper-grain)"
                  opacity={0.16}
                  style={{ mixBlendMode: "multiply" }}
                />
              </g>
            ) : null;
          })}
          {frame > sobra - 6 ? (
            <rect
              x={left}
              y={bbox[0][1] - 10}
              width={bbox[1][0] - left + 40}
              height={layers[3].top - bbox[0][1] + 10}
              fill="#FFFFFF"
              opacity={0.18 + 0.12 * Math.sin(frame / 4)}
            />
          ) : null}
        </g>
        <path d={dAfrica} fill="none" stroke={P.africa[1]} strokeWidth={4} />
      </Sheet>
      {layers.map((l, i) => (
        <PaperTag
          key={l.key}
          x={900}
          y={tagY[i]}
          rotate={-2}
          scale={0.78}
          opacity={prog(frame, l.at + 4, 10)}
        >
          <div style={{ fontWeight: 900, fontSize: 34, color: l.colors[1] }}>
            {l.label}
          </div>
          <div style={{ fontWeight: 700, fontSize: 26 }}>
            {String(l.area).replace(".", ",")} M km²
          </div>
        </PaperTag>
      ))}
      <Title
        text="¿QUÉ CABE EN ÁFRICA?"
        sub="superficie real · 30,4 M km²"
        o={prog(frame, 6, 12)}
      />
      <PaperTag
        x={540}
        y={1300}
        rotate={3}
        opacity={prog(frame, sobra, 12)}
        color="#FFE45C"
      >
        <div style={{ fontWeight: 900, fontSize: 38 }}>
          …y todavía sobra un {Math.round(leftover)} %
        </div>
      </PaperTag>
    </AbsoluteFill>
  );
};

/** 7 · Un globo de papel: la esfera no se puede aplanar sin deformarla. */
export const GFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const world = useWorld();
  const R = 400;
  const proj = useMemo(
    () => geoOrthographic().scale(R).translate([540, 760]).clipAngle(90),
    [],
  );
  proj.rotate([-frame * 0.6 + 20, -18]);
  const path = geoPath(proj);
  const all = [
    ...world.groups.map((g) => g.feat),
    world.greenland,
    world.russia,
    world.antarctica,
  ];
  return (
    <AbsoluteFill style={{ background: P.table }}>
      <svg width={W} height={1920} style={{ position: "absolute", inset: 0 }}>
        <PaperDefs />
        <defs>
          <radialGradient id="globeShade" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.35} />
            <stop offset="55%" stopColor="#FFFFFF" stopOpacity={0} />
            <stop offset="100%" stopColor="#0B2333" stopOpacity={0.45} />
          </radialGradient>
        </defs>
        <ellipse
          cx={560}
          cy={1215}
          rx={330}
          ry={46}
          fill="#000"
          opacity={0.35}
        />
        <g filter="url(#paper-shadow-3)">
          <circle cx={540} cy={760} r={R} fill="url(#sea)" />
          <circle cx={540} cy={760} r={R} fill={P.sea} />
        </g>
        <path
          d={path(geoGraticule().step([15, 15])()) ?? ""}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
        {all.map((f, i) => (
          <PaperPiece
            key={i}
            d={path(f) ?? ""}
            color={P.land[0]}
            edge={P.land[1]}
            thickness={2}
          />
        ))}
        <PaperPiece
          d={path(world.africa) ?? ""}
          color={P.africa[0]}
          edge={P.africa[1]}
          thickness={2}
        />
        <circle cx={540} cy={760} r={R} fill="url(#globeShade)" />
        <circle
          cx={540}
          cy={760}
          r={R}
          fill="url(#paper-grain)"
          opacity={0.15}
          style={{ mixBlendMode: "multiply" }}
        />
      </svg>
      <PaperTag x={540} y={110} rotate={-2} opacity={prog(frame, 6, 12)}>
        <div style={{ fontWeight: 900, fontSize: 44 }}>
          SOLO UN GLOBO NO MIENTE
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 24,
            color: "#7A6A5E",
            marginTop: 4,
          }}
        >
          Gauss, 1827: una esfera no se aplana sin deformarse
        </div>
      </PaperTag>
      <PaperTag
        x={540}
        y={1300}
        rotate={2}
        opacity={prog(frame, c.start("g9"), 12)}
        color="#FFE45C"
      >
        <div style={{ fontWeight: 900, fontSize: 40 }}>
          ¿Qué país sale más estirado?
        </div>
      </PaperTag>
    </AbsoluteFill>
  );
};
