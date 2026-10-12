import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Line, Polyline, Rect } from 'react-native-svg';

import { MoneyText, formatMoney } from '@/components/money-text';
import { Text } from '@/components/text';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { centsToAmount } from '@/lib/money';
import type { ForecastChart as ForecastChartData } from '@/features/forecast/view-model';

type Props = {
  chart: ForecastChartData;
  currency: string;
  /** Spoken summary — the chart never conveys meaning by shape alone. */
  accessibilityLabel: string;
  height?: number;
};

const PAD = { top: spacing.lg, bottom: spacing.sm, horizontal: spacing.xs };
const STROKE = 2;

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const tooltipDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const axisDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The forecast line chart. Two cumulative series share one y-axis: the ink line
 * is the full projection (scheduled + estimated spending), the grey line is
 * scheduled commitments only — so the gap between them reads as estimated
 * discretionary spend. Press and drag to inspect any day. Honours reduced motion;
 * the surrounding screen provides the text-equivalent summary.
 */
export function ForecastChart({ chart, currency, accessibilityLabel, height = 170 }: Props) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const reveal = useSharedValue(0);

  const innerW = Math.max(width - PAD.horizontal * 2, 0);
  const innerH = height - PAD.top - PAD.bottom;
  const n = chart.points.length;

  // Pad a flat domain so a straight line sits mid-height rather than on an edge.
  const rawMin = chart.minCents;
  const rawMax = chart.maxCents;
  const pad = rawMax - rawMin === 0 ? Math.max(Math.abs(rawMax), 100) : (rawMax - rawMin) * 0.12;
  const minV = rawMin - pad;
  const maxV = rawMax + pad;

  const x = (index: number) => PAD.horizontal + (n <= 1 ? innerW / 2 : (index / (n - 1)) * innerW);
  const y = (cents: number) => PAD.top + innerH - ((cents - minV) / (maxV - minV)) * innerH;

  const toPoints = (key: 'fullCents' | 'scheduledCents') =>
    chart.points.map((p) => `${x(p.index).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

  useEffect(() => {
    if (innerW <= 0) return;
    reveal.set(reduceMotion ? 1 : withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [innerW, reduceMotion, reveal]);

  const clipProps = useAnimatedProps(() => ({ width: reveal.get() * innerW }));

  const scrubTo = (px: number) => {
    if (n === 0) return;
    const ratio = innerW <= 0 ? 0 : (px - PAD.horizontal) / innerW;
    const index = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));
    setSelected((prev) => {
      if (prev !== index) haptics.selection();
      return index;
    });
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onBegin((e) => runOnJS(scrubTo)(e.x))
    .onUpdate((e) => runOnJS(scrubTo)(e.x))
    .onFinalize(() => runOnJS(setSelected)(null));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const end = chart.points[n - 1];
  const point = selected !== null ? chart.points[selected] : null;
  const baselineY = y(chart.baselineCents);
  const showBaseline = chart.baselineCents >= minV && chart.baselineCents <= maxV;

  // Clamp the tooltip so it never overflows the chart edges.
  const tooltipW = 172;
  const tooltipX = point ? Math.max(0, Math.min(width - tooltipW, x(point.index) - tooltipW / 2)) : 0;
  const valueLabel = chart.hasBalance ? 'Projected balance' : 'Net change';

  return (
    <View style={styles.container}>
      <GestureDetector gesture={pan}>
        <View
          style={{ height }}
          onLayout={onLayout}
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Drag across the chart to inspect any day"
        >
          {width > 0 && n > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <ClipPath id="forecast-reveal">
                  <AnimatedRect x={0} y={0} height={height} animatedProps={clipProps} />
                </ClipPath>
              </Defs>

              {showBaseline ? (
                <Line
                  x1={PAD.horizontal}
                  y1={baselineY}
                  x2={width - PAD.horizontal}
                  y2={baselineY}
                  stroke={colors.divider}
                  strokeWidth={StyleSheet.hairlineWidth}
                  strokeDasharray="2 4"
                />
              ) : null}

              <G clipPath="url(#forecast-reveal)">
                {n > 1 ? (
                  <Polyline
                    points={toPoints('scheduledCents')}
                    fill="none"
                    stroke={colors.disabled}
                    strokeWidth={STROKE}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {n > 1 ? (
                  <Polyline
                    points={toPoints('fullCents')}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth={STROKE}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : null}
                {end ? <Circle cx={x(end.index)} cy={y(end.fullCents)} r={3} fill={colors.primary} /> : null}
              </G>

              {point ? (
                <>
                  <Line
                    x1={x(point.index)}
                    y1={PAD.top}
                    x2={x(point.index)}
                    y2={PAD.top + innerH}
                    stroke={colors.primary}
                    strokeWidth={StyleSheet.hairlineWidth}
                  />
                  <Circle cx={x(point.index)} cy={y(point.fullCents)} r={4} fill={colors.primary} />
                </>
              ) : null}
            </Svg>
          ) : null}

          {point ? (
            <View style={[styles.tooltip, { left: tooltipX, width: tooltipW }]} pointerEvents="none">
              <Text variant="metadata" color={colors.textSecondary}>
                {tooltipDate.format(parseKey(point.date))} · {valueLabel}
              </Text>
              <MoneyText amount={centsToAmount(point.fullCents)} currency={currency} variant="amount" />
              {point.events.slice(0, 2).map((ev, i) => (
                <Text key={`${ev.date}-${ev.label}-${i}`} variant="metadata" color={colors.textSecondary} numberOfLines={1}>
                  {ev.direction === 'income' ? '+' : '−'}
                  {formatMoney(centsToAmount(Math.abs(ev.amountCents)), currency)} · {ev.label}
                </Text>
              ))}
              {point.events.length > 2 ? (
                <Text variant="metadata" color={colors.disabled}>
                  +{point.events.length - 2} more
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </GestureDetector>

      <View style={styles.axis}>
        <Text variant="metadata" color={colors.disabled}>
          {chart.points[0] ? axisDate.format(parseKey(chart.points[0].date)) : ''}
        </Text>
        <Text variant="metadata" color={colors.disabled}>
          {end ? axisDate.format(parseKey(end.date)) : ''}
        </Text>
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.primary} label={chart.hasBalance ? 'Projected balance' : 'Projected net'} />
        <LegendItem color={colors.disabled} label="Scheduled only" />
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text variant="metadata" color={colors.textSecondary} style={styles.legendText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    gap: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 14,
    height: 2,
    borderRadius: radius.pill,
  },
  legendText: {
    fontFamily: fontFamily.medium,
  },
});
