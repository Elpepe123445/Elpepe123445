import {
  geoEquirectangular,
  geoGraticule,
  geoMercator,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import land50 from "world-atlas/land-50m.json";
import { C } from "../engine/theme";

export type LonLat = [number, number];
export type View = { x: number; y: number; w: number; h: number };

export type MapApi = {
  project: (p: LonLat) => [number, number];
  /** Trazado SVG de una línea geográfica (lista de [lon, lat]). */
  line: (coords: LonLat[]) => string;
  /** Escala actual de la cámara: multiplica tamaños para que se vean constantes en pantalla. */
  k: number;
};

type Props = {
  /** Región que ocupa el encuadre completo cuando la vista es la "inicial". */
  fit: [LonLat, LonLat];
  /** Encuadre actual (en píxeles del mapa ajustado); anímalo para hacer zoom y paneos.
   *  Puede ser una función que recibe `project` para encuadrar sobre lugares concretos. */
  view?: View | ((project: (p: LonLat) => [number, number]) => View);
  detail?: "50m" | "110m";
  projection?: "mercator" | "equirectangular";
  rotate?: number;
  land?: string;
  ocean?: string;
  coast?: string;
  graticuleStep?: number;
  /** Tamaño propio (para mapas insertados); por defecto, el del video. */
  size?: { width: number; height: number };
  children?: (api: MapApi) => React.ReactNode;
};

/** Mapa histórico vectorial (Natural Earth + d3-geo) con cámara por `viewBox`. */
export const GeoMap: React.FC<Props> = ({
  fit,
  view,
  detail = "50m",
  projection = "mercator",
  rotate = 0,
  land = "#2A2418",
  ocean = C.navy,
  coast = "#C9A66B",
  graticuleStep = 5,
  size,
  children,
}) => {
  const video = useVideoConfig();
  const { width, height } = size ?? video;

  const { proj, landPath, gratPath } = useMemo(() => {
    const topo = (detail === "50m" ? land50 : land110) as unknown as Topology;
    const p: GeoProjection = (
      projection === "mercator" ? geoMercator() : geoEquirectangular()
    ).rotate([rotate, 0]);
    const [[w0, s0], [e0, n0]] = fit;
    p.fitExtent(
      [
        [0, 0],
        [width, height],
      ],
      {
        type: "MultiPoint",
        coordinates: [
          [w0, s0],
          [e0, n0],
          [w0, n0],
          [e0, s0],
        ],
      },
    );
    p.clipExtent([
      [-width, -height],
      [2 * width, 2 * height],
    ]);
    const path = geoPath(p);
    return {
      proj: p,
      landPath: path(feature(topo, topo.objects.land)) ?? "",
      gratPath:
        path(geoGraticule().step([graticuleStep, graticuleStep])()) ?? "",
    };
  }, [fit, detail, projection, rotate, width, height, graticuleStep]);

  const project = (pt: LonLat): [number, number] =>
    (proj(pt) as [number, number] | null) ?? [0, 0];
  const v = (typeof view === "function" ? view(project) : view) ?? {
    x: 0,
    y: 0,
    w: width,
    h: height,
  };
  const api: MapApi = {
    project,
    line: (coords) =>
      geoPath(proj)({ type: "LineString", coordinates: coords }) ?? "",
    k: v.w / width,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      <defs>
        <radialGradient id="oceanGlow" cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#13284A" />
          <stop offset="100%" stopColor={ocean} />
        </radialGradient>
      </defs>
      <rect
        x={-width}
        y={-height}
        width={width * 3}
        height={height * 3}
        fill="url(#oceanGlow)"
      />
      <path
        d={gratPath}
        fill="none"
        stroke="#3B5480"
        strokeOpacity={0.35}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={landPath}
        fill={land}
        stroke={coast}
        strokeWidth={1.6}
        strokeOpacity={0.85}
        vectorEffect="non-scaling-stroke"
      />
      {children?.(api)}
    </svg>
  );
};

/** Interpola dos encuadres (para acercamientos de cámara sobre el mapa). */
export const lerpView = (a: View, b: View, t: number): View => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

/** Encuadre de 16:9 centrado en un punto proyectado, con un ancho dado. */
export const viewAround = ([cx, cy]: [number, number], w: number): View => ({
  x: cx - w / 2,
  y: cy - (w * 9) / 32,
  w,
  h: (w * 9) / 16,
});

/** Marcador de ciudad con pulso y etiqueta de tamaño constante en pantalla. */
export const CityMarker: React.FC<{
  at: [number, number];
  k: number;
  label: string;
  sub?: string;
  appear: number;
  pulse: number;
  color?: string;
  side?: "left" | "right";
}> = ({ at, k, label, sub, appear, pulse, color = C.gold, side = "right" }) => {
  if (appear <= 0) return null;
  const [x, y] = at;
  const dx = (side === "right" ? 26 : -26) * k;
  const anchor = side === "right" ? "start" : "end";
  return (
    <g opacity={appear}>
      <circle
        cx={x}
        cy={y}
        r={(10 + pulse * 40) * k}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={1 - pulse}
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x} cy={y} r={9 * k * appear} fill={color} />
      <circle cx={x} cy={y} r={4 * k} fill="#fff" />
      <text
        x={x + dx}
        y={y + 6 * k}
        fill={C.text}
        fontSize={40 * k}
        fontFamily="Cinzel"
        fontWeight={700}
        textAnchor={anchor}
        style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 6 * k }}
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x + dx}
          y={y + 46 * k}
          fill={C.muted}
          fontSize={28 * k}
          fontFamily="Inter"
          textAnchor={anchor}
          style={{ paintOrder: "stroke", stroke: "#0008", strokeWidth: 5 * k }}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
};
