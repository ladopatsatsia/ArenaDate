import { forwardRef, type ComponentProps, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeInput,
  View,
  type ButtonProps,
  type TextProps,
  type TextInputProps,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Link as RouterLink } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from './theme';
import { ListSkeleton } from './Skeleton';

export * from './Skeleton';

export function Text({ style, ...props }: TextProps) {
  const { i18n } = useTranslation();
  return (
    <NativeText
      allowFontScaling
      accessibilityLanguage={i18n.language === 'ka' ? 'ka-GE' : 'en-US'}
      {...props}
      style={[
        styles.text,
        props.accessibilityRole === 'header' && styles.heading,
        props.accessibilityRole === 'alert' && styles.error,
        style,
      ]}
    />
  );
}

export function Button({
  title,
  onPress,
  disabled,
  accessibilityLabel,
  color,
  variant = 'secondary',
  selected,
  busy = false,
  style,
  textStyle,
  ...props
}: ButtonProps & {
  variant?: 'primary' | 'secondary' | 'danger' | 'vip' | 'romance';
  selected?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  textStyle?: StyleProp<TextStyle>;
}) {
  const chosen = selected ?? title.startsWith('✓ ');
  const isVip = variant === 'vip';
  const isDanger = variant === 'danger';
  const filled = variant === 'primary' || variant === 'romance' || chosen;

  const spinnerColor = isVip
    ? '#FCD34D'
    : filled
    ? '#FFFFFF'
    : isDanger
    ? theme.colors.danger
    : '#FB7185';

  return (
    <Pressable
      {...props}
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled || busy, busy, selected: chosen }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        filled && styles.primary,
        isVip && styles.vip,
        isDanger && styles.danger,
        (disabled || busy) && styles.disabled,
        pressed && !disabled && styles.pressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      {busy && <ActivityIndicator size="small" color={spinnerColor} />}
      <Text
        style={[
          styles.buttonText,
          color ? { color } : undefined,
          filled && styles.primaryText,
          isVip && styles.vipText,
          isDanger && styles.dangerText,
          (disabled || busy) && styles.disabledText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export const TextInput = forwardRef<NativeInput, TextInputProps>(function TextInput(
  { style, ...props },
  ref
) {
  return (
    <NativeInput
      ref={ref}
      allowFontScaling
      placeholderTextColor={theme.colors.muted}
      selectionColor={theme.colors.primary}
      {...props}
      style={[
        styles.input,
        props.multiline && { textAlignVertical: 'top' },
        props.editable === false && styles.disabled,
        style,
      ]}
    />
  );
});

export function Link({ style, ...props }: ComponentProps<typeof RouterLink>) {
  return <RouterLink {...props} style={[styles.link, style]} />;
}

export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

export function StateMessage({
  title,
  body,
  loading = false,
  action,
}: PropsWithChildren<{
  title: string;
  body?: string;
  loading?: boolean;
  action?: { label: string; run: () => void };
}>) {
  if (loading) {
    return (
      <View accessibilityLabel={title} accessibilityRole="progressbar" style={{ width: '100%' }}>
        <ListSkeleton count={3} />
      </View>
    );
  }
  return (
    <Card>
      <View style={{ gap: theme.space.md }}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite">
          {title}
        </Text>
        {body && <Text>{body}</Text>}
        {action && <Button title={action.label} onPress={action.run} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: theme.type.body, lineHeight: 24, color: theme.colors.text },
  heading: { fontSize: theme.type.heading, fontWeight: '700', lineHeight: 32 },
  error: { color: theme.colors.danger },
  button: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    borderRadius: 28,
    backgroundColor: '#271C38',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
        } as any)
      : {}),
  },
  primary: {
    backgroundColor: '#FB7185',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#FB7185',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? ({
          background: 'linear-gradient(135deg, #FB7185 0%, #8B5CF6 100%)',
          boxShadow: '0 4px 22px rgba(251, 113, 133, 0.45)',
        } as any)
      : {}),
  },
  vip: {
    backgroundColor: '#15101E',
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? ({
          background: 'linear-gradient(135deg, #1C1824 0%, #0D0A14 100%)',
          boxShadow: '0 4px 20px rgba(245, 158, 11, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
        } as any)
      : {}),
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  disabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'none',
          cursor: 'not-allowed',
        } as any)
      : {}),
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    color: '#FB7185',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    flexShrink: 1,
    letterSpacing: 0.3,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  vipText: {
    color: '#FCD34D',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dangerText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  disabledText: {
    color: theme.colors.muted,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.control,
    padding: 14,
    fontSize: theme.type.body,
    lineHeight: 24,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  link: {
    minHeight: theme.touch,
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.space.md,
  },
});
