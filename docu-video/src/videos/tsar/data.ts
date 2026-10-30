import type { LonLat } from "../../components/GeoMap";

/**
 * Datos verificados (fuentes en content/tsar/FUENTES.md):
 * Nuclear Weapon Archive (NWA) y Center for Arms Control (ACC).
 */
export const TSAR = {
  testMt: 50, // NWA: 50 Mt (EE. UU. estimó 57 en 1961; fuentes rusas desde 1991: 50)
  designMt: 100, // NWA: rendimiento máximo de diseño
  massT: 27, // NWA: ≈27 t (24,5–27,5)
  lengthM: 8,
  diameterM: 2.1,
  releaseM: 10500, // NWA: lanzada a 10.500 m
  burstM: 4000, // NWA: detonación a 4.000 m
  descentS: 188, // NWA: 188 s de descenso con paracaídas
  fireballKm: 8, // ACC: "five-mile-wide fireball"
  cloudKm: 64, // NWA: hasta 64 km
  everestKm: 8.849,
  airlinerKm: 11,
  flashKm: 1000, // NWA: destello visible a 1.000 km
  windowsKm: 900, // NWA: cristales rotos parcialmente hasta 900 km
  severnyKm: 55, // NWA: Severny, 55 km, todos los edificios destruidos
  hiroshimaKt: 15, // NWA: estimaciones de 12 a 16 kt
  waveLaps: 3, // NWA y ACC
};

export const GROUND_ZERO: LonLat = [54.5, 73.85]; // NWA: ≈73,85 N 54,50 E (bahía de Mitiushija, Nueva Zembla)
export const PLACES: Record<string, LonLat> = {
  murmansk: [33.08, 68.97],
  dikson: [80.55, 73.51],
  arkhangelsk: [40.54, 64.54],
};
