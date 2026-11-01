import { geoCentroid, geoInterpolate, geoRotation } from "d3-geo";
import React, { useMemo } from "react";
import { random } from "remotion";
import { feature, merge } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110 from "world-atlas/countries-110m.json";

/**
 * Estética "papel recortado": piezas con grosor (capas desplazadas), sombra proyectada
 * que crece al levantarlas y grano de papel. Todo vectorial y determinista.
 */

const TOPO = countries110 as unknown as Topology;
const GEOMS = (TOPO.objects.countries as GeometryCollection).geometries;

export type Feat = GeoJSON.Feature<GeoJSON.Geometry>;

/** Países por código ISO numérico (como en Natural Earth / world-atlas). */
export const countryById = (id: string): Feat => {
  const g = GEOMS.find((x) => String(x.id) === id);
  if (!g) throw new Error(`País ${id} no encontrado`);
  return feature(TOPO, g) as unknown as Feat;
};

/** Une varios países en una sola pieza (sin fronteras interiores). */
export const mergeCountries = (
  filter: (id: string, name: string, centroid: [number, number]) => boolean,
): Feat => {
  const picked = GEOMS.filter((g) => {
    const f = feature(TOPO, g) as unknown as Feat;
    return filter(
      String(g.id),
      String((g.properties as { name?: string })?.name ?? ""),
      geoCentroid(f) as [number, number],
    );
  });
  return {
    type: "Feature",
    properties: {},
    geometry: merge(TOPO, picked as never),
  } as Feat;
};

export const allCountries = (): Feat[] =>
  GEOMS.map((g) => feature(TOPO, g) as unknown as Feat);

const mapCoords = (
  geom: GeoJSON.Geometry,
  fn: (p: [number, number]) => [number, number],
): GeoJSON.Geometry => {
  const ring = (r: number[][]) => r.map((p) => fn([p[0], p[1]]));
  switch (geom.type) {
    case "Polygon":
      return { type: "Polygon", coordinates: geom.coordinates.map(ring) };
    case "MultiPolygon":
      return {
        type: "MultiPolygon",
        coordinates: geom.coordinates.map((poly) => poly.map(ring)),
      };
    default:
      return geom;
  }
};

/**
 * Traslada una forma sobre la esfera (no sobre el plano) desde su centro hasta `to`.
 * Al proyectarla después, su tamaño en el mapa cambia como en la realidad: "tamaño verdadero".
 */
export const moveOnSphere = (
  f: Feat,
  to: [number, number],
  t: number,
  spin = 0,
): Feat => {
  const from = geoCentroid(f) as [number, number];
  const target = geoInterpolate(from, to)(t) as [number, number];
  const toOrigin = geoRotation([-from[0], -from[1]]);
  const roll = geoRotation([0, 0, spin * t]);
  const toTarget = geoRotation([-target[0], -target[1]]);
  return {
    ...f,
    geometry: mapCoords(
      f.geometry,
      (p) =>
        toTarget.invert(roll(toOrigin(p)) as [number, number]) as [
          number,
          number,
        ],
    ),
  };
};

/** Definiciones SVG compartidas: grano de papel y sombras. Inclúyelas una vez por SVG. */
export const PaperDefs: React.FC<{ id?: string }> = ({ id = "paper" }) => {
  const grain = useMemo(() => {
    if (typeof document === "undefined") return "";
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (random(`pg${i}`) - 0.5) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, []);
  return (
    <defs>
      <pattern
        id={`${id}-grain`}
        width={160}
        height={160}
        patternUnits="userSpaceOnUse"
      >
        <image href={grain} width={160} height={160} />
      </pattern>
      {[0, 1, 2, 3].map((lvl) => (
        <filter
          key={lvl}
          id={`${id}-shadow-${lvl}`}
          x="-30%"
          y="-30%"
          width="160%"
          height="170%"
        >
          <feDropShadow
            dx={0}
            dy={6 + lvl * 10}
            stdDeviation={5 + lvl * 7}
            floodColor="#1B1410"
            floodOpacity={0.32 - lvl * 0.03}
          />
        </filter>
      ))}
    </defs>
  );
};

/**
 * Pieza de papel: cara, canto (grosor) y grano. `lift` 0→1 la levanta de la mesa
 * (más sombra, desplazamiento hacia arriba) como si la tomaras con los dedos.
 */
export const PaperPiece: React.FC<{
  d: string;
  color: string;
  edge: string;
  lift?: number;
  thickness?: number;
  opacity?: number;
  id?: string;
  stroke?: string;
}> = ({
  d,
  color,
  edge,
  lift = 0,
  thickness = 5,
  opacity = 1,
  id = "paper",
  stroke,
}) => {
  const lvl = Math.min(3, Math.round(lift * 3));
  const up = lift * 18;
  return (
    <g
      opacity={opacity}
      transform={`translate(0 ${-up})`}
      filter={`url(#${id}-shadow-${lvl})`}
    >
      {new Array(thickness).fill(0).map((_, i) => (
        <path
          key={i}
          d={d}
          fill={edge}
          transform={`translate(0 ${thickness - i})`}
        />
      ))}
      <path
        d={d}
        fill={color}
        stroke={stroke ?? edge}
        strokeWidth={stroke ? 2 : 0.8}
        strokeLinejoin="round"
      />
      <path
        d={d}
        fill={`url(#${id}-grain)`}
        opacity={0.16}
        style={{ mixBlendMode: "multiply" }}
      />
    </g>
  );
};

/** Etiqueta de papel con chincheta, ligeramente girada. */
export const PaperTag: React.FC<{
  x: number;
  y: number;
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  scale?: number;
  opacity?: number;
}> = ({
  x,
  y,
  children,
  color = "#FFFDF6",
  rotate = -3,
  scale = 1,
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      translate: "-50% -50%",
      rotate: `${rotate}deg`,
      scale: String(scale),
      opacity,
      background: color,
      padding: "16px 28px",
      borderRadius: 10,
      boxShadow: "0 14px 30px rgba(27,20,16,0.35), 0 2px 0 rgba(0,0,0,0.08)",
      fontFamily: "Inter, DejaVu Sans, sans-serif",
      color: "#2B2420",
      textAlign: "center",
      whiteSpace: "nowrap",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: -10,
        left: "50%",
        translate: "-50% 0",
        width: 20,
        height: 20,
        borderRadius: 10,
        background: "radial-gradient(circle at 35% 35%, #FF8A7A, #C0392B)",
        boxShadow: "0 3px 5px rgba(0,0,0,0.35)",
      }}
    />
    {children}
  </div>
);
