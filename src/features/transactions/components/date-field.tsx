import { useState } from 'react';
import { Platform } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { FieldButton } from '@/components/field-button';
import { PrimaryButton } from '@/components/primary-button';
import { colors } from '@/constants/theme';
import { haptics } from '@/lib/haptics';

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

/** Date field backed by the native picker (dialog on Android, inline on iOS). */
export function DateField({ value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const maximumDate = new Date();

  const onNative = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) {
        haptics.selection();
        onChange(selected);
      }
      return;
    }
    if (selected) onChange(selected);
  };

  return (
    <>
      <FieldButton
        label="Date"
        value={formatDateLabel(value)}
        onPress={() => setOpen(true)}
        error={error}
        right={<Calendar size={18} color={colors.textSecondary} strokeWidth={1.8} />}
      />

      {Platform.OS === 'android' && open ? (
        <DateTimePicker value={value} mode="date" maximumDate={maximumDate} onChange={onNative} />
      ) : null}

      {Platform.OS === 'ios' ? (
        <BottomSheet visible={open} onClose={() => setOpen(false)} title="Date">
          <DateTimePicker
            value={value}
            mode="date"
            display="inline"
            maximumDate={maximumDate}
            onChange={onNative}
            themeVariant="light"
            accentColor={colors.primary}
          />
          <PrimaryButton
            label="Done"
            onPress={() => {
              haptics.selection();
              setOpen(false);
            }}
          />
        </BottomSheet>
      ) : null}
    </>
  );
}
