import { Pressable, Text, View } from 'react-native';
import { styles } from '@/lib/theme';

export function Chips<T extends string>({ value, options, multi, onChange, getLabel }: {
  value: T | T[];
  options: readonly { value: T; label: string }[] | readonly T[];
  multi?: boolean;
  onChange: (v: any) => void;
  getLabel?: (v: T) => string;
}) {
  const opts = (options as any[]).map((o) => typeof o === 'string' ? { value: o, label: getLabel ? getLabel(o) : o.replace(/_/g, ' ') } : o);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {opts.map(o => {
        const active = multi ? (value as any[]).includes(o.value) : value === o.value;
        return (
          <Pressable key={o.value} style={[styles.chip, active && styles.chipActive]}
            onPress={() => {
              if (multi) {
                const arr = value as T[];
                onChange(arr.includes(o.value) ? arr.filter(x => x !== o.value) : [...arr, o.value]);
              } else onChange(o.value);
            }}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
