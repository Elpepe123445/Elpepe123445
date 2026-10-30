import type { LonLat } from "../../components/GeoMap";

/** Datos del video (fuentes en content/eratostenes/GUION.md). Cambiar aquí, no en las escenas. */
export const DATA = {
  angleDeg: 360 / 50, // 1/50 de círculo (Cleomedes) = 7,2°
  fraction: 50,
  distanceStadia: 5000,
  circumferenceStadia: 250000,
  stadionShort: 157.5, // m (estimación baja habitual)
  stadionLong: 185, // m
  modernMeridianKm: 40008, // WGS 84, polo a polo (40.007,86 km)
  sunDistanceMillionKm: 150, // 1 UA ≈ 149,6 millones de km
  metreYear: 1791,
};

export const resultKm = (stadionM: number) =>
  (DATA.circumferenceStadia * stadionM) / 1000;
export const errorPct = (km: number) =>
  ((km - DATA.modernMeridianKm) / DATA.modernMeridianKm) * 100;

export const PLACES: Record<string, LonLat> = {
  alexandria: [29.92, 31.2],
  syene: [32.9, 24.09],
  cyrene: [21.86, 32.82],
  palos: [-6.89, 37.23],
  caribbean: [-75.5, 23.8],
  japan: [139.7, 35.7],
};

export const TROPIC_LAT = 23.44;

/** Trazado aproximado del Nilo (sur → norte) y sus dos brazos del delta. */
export const NILE: LonLat[] = [
  [31.35, 21.8],
  [32.2, 22.4],
  [32.85, 23.2],
  [32.9, 24.09],
  [32.93, 24.47],
  [32.87, 24.98],
  [32.55, 25.29],
  [32.64, 25.69],
  [32.72, 26.16],
  [32.24, 26.05],
  [31.89, 26.34],
  [31.7, 26.56],
  [31.18, 27.18],
  [30.84, 27.73],
  [30.75, 28.1],
  [30.84, 28.65],
  [31.1, 29.07],
  [31.2, 29.34],
  [31.3, 29.85],
  [31.24, 30.05],
  [31.2, 30.2],
];
export const NILE_ROSETTA: LonLat[] = [
  [31.2, 30.2],
  [31.0, 30.6],
  [30.75, 30.95],
  [30.55, 31.2],
  [30.37, 31.46],
];
export const NILE_DAMIETTA: LonLat[] = [
  [31.2, 30.2],
  [31.25, 30.6],
  [31.38, 30.95],
  [31.6, 31.2],
  [31.83, 31.5],
];
