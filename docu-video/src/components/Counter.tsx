import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ease, fmt } from "../engine/theme";

type Props = {
  from?: number;
  to: number;
  start: number;
  duration: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
};

/** Cifra que cuenta hasta su valor (formato numérico español). */
export const Counter: React.FC<Props> = ({
  from = 0,
  to,
  start,
  duration,
  decimals = 0,
  prefix = "",
  suffix = "",
  style,
}) => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [start, start + duration], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}
      {fmt(value, decimals)}
      {suffix}
    </span>
  );
};
