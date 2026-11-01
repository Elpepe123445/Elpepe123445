import React from "react";

/**
 * Estilo "plastilina": cualquier forma plana recibe volumen con un filtro de iluminación SVG
 * (relieve difuso + brillo especular sobre su silueta difuminada) y una sombra suave.
 */
export const ClayDefs: React.FC = () => (
  <defs>
    <filter
      id="clay"
      x="-25%"
      y="-25%"
      width="150%"
      height="160%"
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="blur" />
      <feDiffuseLighting
        in="blur"
        surfaceScale="5"
        diffuseConstant="1.05"
        lightingColor="#FFFFFF"
        result="diff"
      >
        <feDistantLight azimuth="235" elevation="52" />
      </feDiffuseLighting>
      <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffIn" />
      <feBlend
        in="SourceGraphic"
        in2="diffIn"
        mode="multiply"
        result="shaded"
      />
      <feSpecularLighting
        in="blur"
        surfaceScale="6"
        specularConstant="0.75"
        specularExponent="22"
        lightingColor="#FFFFFF"
        result="spec"
      >
        <feDistantLight azimuth="235" elevation="48" />
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
      <feComposite
        in="shaded"
        in2="specIn"
        operator="arithmetic"
        k1="0"
        k2="1.12"
        k3="0.55"
        k4="0"
        result="lit"
      />
      <feDropShadow
        in="lit"
        dx="0"
        dy="14"
        stdDeviation="12"
        floodColor="#3A2440"
        floodOpacity="0.28"
      />
    </filter>
  </defs>
);

/** Aplica el volumen de plastilina a su contenido. */
export const Clay: React.FC<{
  children: React.ReactNode;
  transform?: string;
  opacity?: number;
}> = ({ children, transform, opacity = 1 }) => (
  <g filter="url(#clay)" transform={transform} opacity={opacity}>
    {children}
  </g>
);

/* ——— Figuras (origen en la base, centradas; ~200 px de alto) ——— */

export const Pyramid: React.FC = () => (
  <g>
    <path d="M -120 0 L 0 -170 L 120 0 Z" fill="#E9B866" />
    <path d="M 0 -170 L 120 0 L 30 0 Z" fill="#C9913F" />
    {[0.25, 0.5, 0.75].map((k) => (
      <line
        key={k}
        x1={-120 + 120 * k}
        y1={-170 * k + 0}
        x2={120 - 120 * k}
        y2={-170 * k}
        stroke="#B98236"
        strokeWidth={3}
        opacity={0.35}
        transform={`translate(0 ${-170 * (1 - k) + 170 * (1 - k)})`}
      />
    ))}
  </g>
);

export const Cleopatra: React.FC = () => (
  <g>
    <path
      d="M -95 0 C -95 -60 -60 -80 0 -80 C 60 -80 95 -60 95 0 Z"
      fill="#2E6FD8"
    />
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M ${-80 + i * 8} ${-14 - i * 18} C -50 ${-56 - i * 14} 50 ${-56 - i * 14} ${80 - i * 8} ${-14 - i * 18}`}
        fill="none"
        stroke={i % 2 ? "#F2C14E" : "#E04E6A"}
        strokeWidth={9}
        strokeLinecap="round"
      />
    ))}
    <rect x={-22} y={-110} width={44} height={40} rx={14} fill="#C98B5E" />
    <ellipse cx={0} cy={-150} rx={50} ry={58} fill="#D89A6A" />
    <path
      d="M -62 -150 C -66 -225 66 -225 62 -150 L 66 -95 L 40 -95 L 40 -160 C 20 -178 -20 -178 -40 -160 L -40 -95 L -66 -95 Z"
      fill="#1F1B2E"
    />
    <rect x={-58} y={-196} width={116} height={14} rx={7} fill="#F2C14E" />
    <path
      d="M -6 -210 C -16 -230 16 -230 6 -210 L 4 -196 L -4 -196 Z"
      fill="#F2C14E"
    />
    <ellipse cx={-18} cy={-150} rx={6} ry={7} fill="#1F1B2E" />
    <ellipse cx={18} cy={-150} rx={6} ry={7} fill="#1F1B2E" />
    <path
      d="M -30 -158 L -8 -154 M 30 -158 L 8 -154"
      stroke="#1F1B2E"
      strokeWidth={5}
      strokeLinecap="round"
    />
    <path
      d="M -12 -122 Q 0 -114 12 -122"
      stroke="#B4405A"
      strokeWidth={6}
      fill="none"
      strokeLinecap="round"
    />
  </g>
);

export const Moon: React.FC = () => (
  <g>
    <circle cx={0} cy={-90} r={90} fill="#C9CCD8" />
    <circle cx={-30} cy={-115} r={18} fill="#A9ADBD" />
    <circle cx={28} cy={-70} r={24} fill="#A9ADBD" />
    <circle cx={35} cy={-130} r={10} fill="#A9ADBD" />
    <g transform="translate(-10 -150)">
      <rect x={-3} y={-60} width={6} height={60} fill="#E6E6EE" />
      <rect x={3} y={-60} width={44} height={28} fill="#FFFFFF" />
      <rect x={3} y={-60} width={18} height={14} fill="#3C5BD6" />
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={21}
          y={-60 + i * 9}
          width={26}
          height={4}
          fill="#E04E6A"
        />
      ))}
    </g>
  </g>
);

export const Mammoth: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <g>
    {[-70, -35, 30, 62].map((x, i) => (
      <rect
        key={i}
        x={x - 14}
        y={-70 + (i % 2 ? Math.sin(step) * 6 : -Math.sin(step) * 6)}
        width={30}
        height={70}
        rx={14}
        fill="#6B4228"
      />
    ))}
    <ellipse cx={0} cy={-105} rx={105} ry={70} fill="#8A5634" />
    <path
      d="M -80 -150 C -70 -175 -20 -180 10 -168"
      stroke="#6B4228"
      strokeWidth={16}
      fill="none"
      strokeLinecap="round"
    />
    <circle cx={88} cy={-138} r={52} fill="#8A5634" />
    <path
      d="M 120 -120 C 150 -90 140 -40 120 -25"
      stroke="#7A4A2C"
      strokeWidth={24}
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M 105 -105 C 150 -95 170 -70 150 -45"
      stroke="#FFF6E6"
      strokeWidth={11}
      fill="none"
      strokeLinecap="round"
    />
    <circle cx={100} cy={-150} r={6} fill="#1F1B2E" />
    <ellipse cx={58} cy={-150} rx={22} ry={30} fill="#6B4228" />
  </g>
);

export const PineTree: React.FC = () => (
  <g>
    <path
      d="M -24 0 C -30 -60 -6 -90 -16 -140 C 10 -120 6 -60 24 0 Z"
      fill="#8B5A3C"
    />
    <path
      d="M -16 -110 C -60 -130 -80 -120 -100 -140"
      stroke="#8B5A3C"
      strokeWidth={12}
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M 0 -150 C 40 -170 70 -160 90 -185"
      stroke="#8B5A3C"
      strokeWidth={10}
      fill="none"
      strokeLinecap="round"
    />
    <ellipse cx={-100} cy={-150} rx={46} ry={26} fill="#3E7D4C" />
    <ellipse cx={90} cy={-195} rx={50} ry={28} fill="#3E7D4C" />
    <ellipse cx={-6} cy={-175} rx={56} ry={34} fill="#4F955C" />
  </g>
);

export const Oxford: React.FC = () => (
  <g>
    <rect x={-110} y={-120} width={220} height={120} rx={8} fill="#E4C79A" />
    {[-90, 70].map((x, i) => (
      <g key={i}>
        <rect x={x} y={-190} width={22} height={70} fill="#D6B47F" />
        <path
          d={`M ${x - 4} -190 L ${x + 11} -235 L ${x + 26} -190 Z`}
          fill="#8C6A4A"
        />
      </g>
    ))}
    <rect x={-22} y={-200} width={44} height={80} fill="#D6B47F" />
    <path d="M -28 -200 L 0 -262 L 28 -200 Z" fill="#8C6A4A" />
    {[-70, -35, 35, 70].map((x) => (
      <path
        key={x}
        d={`M ${x - 10} -30 L ${x - 10} -80 Q ${x} -96 ${x + 10} -80 L ${x + 10} -30 Z`}
        fill="#6E8BB8"
      />
    ))}
    <path d="M -16 0 L -16 -50 Q 0 -70 16 -50 L 16 0 Z" fill="#8C6A4A" />
  </g>
);

export const AztecTemple: React.FC = () => (
  <g>
    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={-130 + i * 24}
        y={-40 - i * 40}
        width={260 - i * 48}
        height={42}
        rx={6}
        fill={i % 2 ? "#C77B4A" : "#D98F5C"}
      />
    ))}
    <rect x={-22} y={-160} width={44} height={160} fill="#B86A3C" />
    {[-40, 0].map((x, i) => (
      <g key={i} transform={`translate(${x} 0)`}>
        <rect x={0} y={-205} width={40} height={45} fill="#3C8C83" />
        <rect x={-4} y={-213} width={48} height={10} fill="#E9C46A" />
      </g>
    ))}
  </g>
);

export const Hanafuda: React.FC = () => (
  <g>
    <rect x={-60} y={-190} width={120} height={180} rx={12} fill="#FBF3E4" />
    <rect x={-50} y={-180} width={100} height={160} rx={8} fill="#2B2A4C" />
    <circle cx={0} cy={-120} r={34} fill="#E04E6A" />
    <path
      d="M -50 -60 C -20 -90 20 -40 50 -70 L 50 -20 L -50 -20 Z"
      fill="#3E7D4C"
    />
    {[-28, 0, 26].map((x, i) => (
      <circle key={i} cx={x} cy={-48 + i * 4} r={9} fill="#F2C14E" />
    ))}
  </g>
);

export const TopHat: React.FC = () => (
  <g>
    <ellipse cx={0} cy={-18} rx={110} ry={22} fill="#26222E" />
    <rect x={-62} y={-150} width={124} height={135} rx={10} fill="#2F2A38" />
    <rect x={-62} y={-50} width={124} height={22} fill="#8E2C3C" />
    <ellipse cx={0} cy={-150} rx={62} ry={14} fill="#3A3446" />
  </g>
);

export const TRex: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <g>
    <path
      d="M -150 -90 C -100 -110 -60 -120 -20 -110 L -20 -80 C -70 -78 -110 -75 -150 -90 Z"
      fill="#4E9A62"
    />
    <ellipse cx={10} cy={-110} rx={70} ry={52} fill="#5BAE70" />
    <rect
      x={-10}
      y={-80 + Math.sin(step) * 5}
      width={26}
      height={80}
      rx={12}
      fill="#4E9A62"
    />
    <rect
      x={30}
      y={-80 - Math.sin(step) * 5}
      width={26}
      height={80}
      rx={12}
      fill="#4E9A62"
    />
    <path
      d="M 50 -150 C 60 -200 150 -205 160 -165 C 165 -140 130 -130 90 -132 L 70 -110 Z"
      fill="#5BAE70"
    />
    <path
      d="M 95 -138 L 155 -146"
      stroke="#FFFFFF"
      strokeWidth={5}
      strokeDasharray="6 5"
    />
    <circle cx={110} cy={-176} r={7} fill="#1F1B2E" />
    <path
      d="M 60 -105 L 82 -95"
      stroke="#4E9A62"
      strokeWidth={9}
      strokeLinecap="round"
    />
  </g>
);

export const Stego: React.FC<{ step?: number }> = ({ step = 0 }) => (
  <g>
    {new Array(7).fill(0).map((_, i) => (
      <path
        key={i}
        d={`M ${-90 + i * 28} ${-118 - Math.sin((i / 6) * Math.PI) * 30} l 16 -42 l 16 42 Z`}
        fill="#E8794F"
      />
    ))}
    <path
      d="M -170 -60 C -130 -70 -100 -80 -80 -82 L -80 -60 Z"
      fill="#7A9BD6"
    />
    <path
      d="M -175 -62 l -14 -16 M -168 -64 l -6 -20"
      stroke="#E8794F"
      strokeWidth={7}
      strokeLinecap="round"
    />
    <ellipse cx={0} cy={-85} rx={110} ry={52} fill="#8AAEE8" />
    {[-60, -20, 30, 70].map((x, i) => (
      <rect
        key={i}
        x={x - 12}
        y={-50 + (i % 2 ? Math.sin(step) * 4 : -Math.sin(step) * 4)}
        width={24}
        height={50}
        rx={10}
        fill="#7A9BD6"
      />
    ))}
    <path
      d="M 100 -95 C 130 -95 150 -80 150 -64 C 130 -58 110 -62 96 -70 Z"
      fill="#8AAEE8"
    />
    <circle cx={132} cy={-80} r={5} fill="#1F1B2E" />
  </g>
);

export const Shark: React.FC<{ swim?: number }> = ({ swim = 0 }) => (
  <g transform={`rotate(${Math.sin(swim) * 3})`}>
    <path
      d="M -150 -60 C -80 -110 60 -112 140 -70 C 150 -64 150 -56 140 -52 C 60 -20 -80 -20 -150 -60 Z"
      fill="#7F96AE"
    />
    <path
      d="M -150 -60 L -200 -110 L -185 -60 L -205 -15 Z"
      fill="#6E849C"
      transform={`rotate(${Math.sin(swim * 2) * 8} -150 -60)`}
    />
    <path d="M -10 -100 L 30 -160 L 50 -96 Z" fill="#6E849C" />
    <path
      d="M -150 -60 C -80 -40 60 -38 140 -58 C 60 -28 -80 -28 -150 -60 Z"
      fill="#E9EEF3"
    />
    <circle cx={100} cy={-75} r={6} fill="#1F1B2E" />
    {[0, 1, 2].map((i) => (
      <path
        key={i}
        d={`M ${60 - i * 10} -78 q 4 10 0 20`}
        stroke="#5D7289"
        strokeWidth={4}
        fill="none"
      />
    ))}
  </g>
);

export const Tree: React.FC = () => (
  <g>
    <rect x={-16} y={-110} width={32} height={110} rx={10} fill="#8B5A3C" />
    <circle cx={0} cy={-150} r={62} fill="#4F955C" />
    <circle cx={-48} cy={-120} r={40} fill="#3E7D4C" />
    <circle cx={46} cy={-118} r={42} fill="#3E7D4C" />
  </g>
);

export const Island: React.FC = () => (
  <g>
    <ellipse cx={0} cy={0} rx={170} ry={34} fill="#DDEFF6" />
    <ellipse cx={-30} cy={-6} rx={110} ry={20} fill="#F4FBFF" />
  </g>
);

export const StumpRings: React.FC<{ rings: number }> = ({ rings }) => (
  <g>
    <ellipse cx={0} cy={0} rx={130} ry={70} fill="#C98B5E" />
    {new Array(Math.max(0, Math.min(14, rings))).fill(0).map((_, i) => (
      <ellipse
        key={i}
        cx={0}
        cy={0}
        rx={130 - i * 9}
        ry={70 - i * 4.8}
        fill="none"
        stroke="#9A6440"
        strokeWidth={2.5}
      />
    ))}
    <ellipse cx={0} cy={0} rx={8} ry={5} fill="#7A4A2C" />
  </g>
);
