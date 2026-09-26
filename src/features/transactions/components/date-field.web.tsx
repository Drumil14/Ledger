/**
 * Date field — web.
 *
 * The native date field opens a platform picker via `@react-native-community/
 * datetimepicker`, which has no web UI, so on web the button would do nothing.
 * This variant keeps the exact same monochrome `FieldButton` look and overlays a
 * transparent native `<input type="date">` so a click opens the browser's own
 * date picker. Same props and `onChange` contract as `date-field.tsx`; native is
 * untouched.
 */

import type { CSSProperties } from 'react';
import { View } from 'react-native';
import { Calendar } from 'lucide-react-native';

import { FieldButton } from '@/components/field-button';
import { colors } from '@/constants/theme';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  error?: string;
};

const mediumFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDateLabel(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const dayMs = 24 * 60 * 60 * 1000;
  if (target === today) return 'Today';
  if (target === today - dayMs) return 'Yesterday';
  return mediumFormatter.format(date);
}

/** `Date` → `YYYY-MM-DD` in local time (the value shape `<input type=date>` uses). */
function toInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// The transparent input sits on top of the styled button and captures the click.
const inputStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  opacity: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
};

export function DateField({ value, onChange, error }: Props) {
  return (
    <View style={styles.container}>
      <FieldButton
        label="Date"
        value={formatDateLabel(value)}
        onPress={() => {}}
        error={error}
        right={<Calendar size={18} color={colors.textSecondary} strokeWidth={1.8} />}
      />
      <input
        type="date"
        aria-label="Date"
        value={toInputValue(value)}
        max={toInputValue(new Date())}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const next = parseInputValue(e.target.value);
          if (next) onChange(next);
        }}
        style={inputStyle}
      />
    </View>
  );
}

const styles = {
  // Positioning context for the absolutely-placed input overlay.
  container: { position: 'relative' as const },
};
