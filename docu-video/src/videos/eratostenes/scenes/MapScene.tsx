import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ChapterTag } from "../../../components/ChapterTag";
import { DrawPath, Sun } from "../../../components/Diagram";
import {
  CityMarker,
  GeoMap,
  lerpView,
  viewAround,
} from "../../../components/GeoMap";
import { C, fonts, inOut, prog } from "../../../engine/theme";
import { useCues } from "../../../engine/timeline";
import { NILE, NILE_DAMIETTA, NILE_ROSETTA, PLACES, TROPIC_LAT } from "../data";

const FIT: [[number, number], [number, number]] = [
  [16, 19],
  [42, 38],
];

export const MapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const c = useCues();
  const m1 = c.start("map-1");
  const m2 = c.start("map-2");
  const siena = c.word("map-1", "siena");
  const asuan = c.word("map-1", "asuan", "end");
  const sol = c.word("map-2", "sol");
  const solsticio = c.word("map-2", "solsticio");
  const zoom = prog(frame, m1 - 10, 90, inOut);

  return (
    <AbsoluteFill style={{ background: C.navy }}>
      <GeoMap
        fit={FIT}
        view={(project) =>
          lerpView(
            { x: 0, y: 0, w: 1920, h: 1080 },
            viewAround(project([31.0, 27.9]), 1180),
            zoom,
          )
        }
      >
        {(m) => {
          const k = m.k;
          const alex = m.project(PLACES.alexandria);
          const syene = m.project(PLACES.syene);
          const tropicY = m.project([30, TROPIC_LAT])[1];
          const sunY =
            syene[1] -
            150 * k -
            300 * k * (1 - prog(frame, sol - 10, 40, inOut));
          const sea = m.project([24.5, 34.6]);
          const egypt = m.project([27.2, 26.4]);
          return (
            <>
              <text
                x={sea[0]}
                y={sea[1]}
                fill="#7D95BF"
                fontSize={34 * k}
                fontFamily={fonts.display}
                letterSpacing={10 * k}
                opacity={0.8}
              >
                MAR MEDITERRÁNEO
              </text>
              <text
                x={egypt[0]}
                y={egypt[1]}
                fill="#9C8A66"
                fontSize={60 * k}
                fontFamily={fonts.display}
                letterSpacing={24 * k}
                opacity={0.55 * prog(frame, m1, 30)}
              >
                EGIPTO
              </text>
              {/* Trópico de Cáncer */}
              <DrawPath
                d={`M -500 ${tropicY} L 2500 ${tropicY}`}
                progress={prog(frame, m2, 40)}
                color={C.cyan}
                width={2}
                dashed
                k={k}
              />
              <text
                x={syene[0] + 330 * k}
                y={tropicY + 44 * k}
                textAnchor="middle"
                fill={C.cyan}
                fontSize={28 * k}
                fontFamily={fonts.body}
                opacity={prog(frame, m2 + 20, 20)}
              >
                Trópico de Cáncer
              </text>
              {/* Nilo y delta */}
              <DrawPath
                d={m.line([...NILE].reverse())}
                progress={prog(frame, m1 + 10, siena - m1 + 10, inOut)}
                color="#5AA9E6"
                width={4}
                glow
                k={k}
              />
              <DrawPath
                d={m.line(NILE_ROSETTA)}
                progress={prog(frame, m1, 30)}
                color="#5AA9E6"
                width={3}
                k={k}
              />
              <DrawPath
                d={m.line(NILE_DAMIETTA)}
                progress={prog(frame, m1, 30)}
                color="#5AA9E6"
                width={3}
                k={k}
              />
              {/* Ruta Alejandría → Siena */}
              <DrawPath
                d={m.line([PLACES.alexandria, PLACES.syene])}
                progress={prog(frame, asuan, 40, inOut)}
                color={C.gold}
                width={3}
                dashed
                k={k}
              />
              {/* Sol de mediodía sobre Siena */}
              <g opacity={prog(frame, sol - 14, 16)}>
                <rect
                  x={syene[0] - 22 * k}
                  y={sunY}
                  width={44 * k}
                  height={Math.max(0, syene[1] - sunY)}
                  fill={C.gold}
                  opacity={0.2 * prog(frame, sol + 20, 20)}
                />
                <Sun
                  x={syene[0]}
                  y={sunY}
                  r={28 * k}
                  spin={frame * 0.4}
                  id="mapSun"
                />
              </g>
              <CityMarker
                at={alex}
                k={k}
                label="Alejandría"
                appear={prog(frame, m1 + 4, 14)}
                pulse={((((frame - m1) % 45) + 45) % 45) / 45}
                side="left"
              />
              <CityMarker
                at={syene}
                k={k}
                label="Siena"
                sub="hoy Asuán"
                appear={prog(frame, siena - 4, 14)}
                pulse={((((frame - siena) % 45) + 45) % 45) / 45}
              />
            </>
          );
        }}
      </GeoMap>
      <div
        style={{
          position: "absolute",
          right: 120,
          top: 200,
          fontFamily: fonts.body,
          fontSize: 34,
          color: C.night,
          background: C.gold,
          padding: "12px 26px",
          borderRadius: 40,
          fontWeight: 600,
          opacity: prog(frame, solsticio - 4, 14),
          translate: `0 ${(1 - prog(frame, solsticio - 4, 20)) * 20}px`,
        }}
      >
        Solsticio de verano · mediodía
      </div>
      <ChapterTag label="I · La pista" />
    </AbsoluteFill>
  );
};
