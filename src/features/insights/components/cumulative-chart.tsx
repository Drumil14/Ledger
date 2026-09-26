import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Text } from '@/components/text';
import { colors, spacing } from '@/constants/theme';
import type { CumulativePoint } from '@/features/insights/analytics';

type Props = {
  current: CumulativePoint[];
  previous: CumulativePoint[];
  totalDays: number;
  /** Spoken summary — the chart never conveys meaning by shape alone. */
  accessibilityLabel: string;
  height?: number;
};

const PADDING = { top: spacing.sm, bottom: spacing.sm, horizontal: spacing.xs };
const STROKE = 2;

/**
 * The one restrained chart: cumulative spend across the month. The current month
 * is drawn in ink, the previous month in grey, on a shared day-of-month x-axis —
 * so "am I above or below last month's line?" reads at a glance. No axes, grids,
 * colour, or animation; a hairline baseline and start/end day labels only.
 */
export function CumulativeChart({
  current,
  previous,
  totalDays,
  accessibilityLabel,
  height = 140,
}: Props) {
  const [width, setWidth] = useState(0);

  const innerW = Math.max(width - PADDING.horizontal * 2, 0);
  const innerH = height - PADDING.top - PADDING.bottom;
  const span = Math.max(totalDays - 1, 1);

  const maxValue = Math.max(
    current.length ? current[current.length - 1].value : 0,
    previous.length ? previous[previous.length - 1].value : 0,
    1
  );

  const x = (day: number) => PADDING.horizontal + ((day - 1) / span) * innerW;
  const y = (value: number) => PADDING.top + innerH - (value / maxValue) * innerH;

  const toPoints = (points: CumulativePoint[]) =>
    points.map((p) => `${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  const currentEnd = current[current.length - 1];

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {/* Baseline */}
            <Line
              x1={PADDING.horizontal}
              y1={PADDING.top + innerH}
              x2={width - PADDING.horizontal}
              y2={PADDING.top + innerH}
              stroke={colors.divider}
              strokeWidth={StyleSheet.hairlineWidth}
            />
            {previous.length > 1 ? (
              <Polyline
                points={toPoints(previous)}
                fill="none"
                stroke={colors.disabled}
                strokeWidth={STROKE}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {current.length > 1 ? (
              <Polyline
                points={toPoints(current)}
                fill="none"
                stroke={colors.primary}
                strokeWidth={STROKE}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {currentEnd ? (
              <Circle cx={x(currentEnd.day)} cy={y(currentEnd.value)} r={3} fill={colors.primary} />
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        <Text variant="metadata" color={colors.disabled}>
          Day 1
        </Text>
        <Text variant="metadata" color={colors.disabled}>
          Day {totalDays}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
