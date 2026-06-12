// 基础 UI 组件库 - 对齐 qoder.apk 视觉风格
import React from 'react';
import {
  TouchableOpacity, Text, View, StyleSheet, ActivityIndicator,
  TextInput, ScrollView, Dimensions, Modal, Pressable,
  type TouchableOpacityProps, type TextInputProps, type ViewStyle, type TextStyle,
} from 'react-native';
import { Colors, FontSize as FS, BorderRadius as BR } from '../../constants';

const isDarkDefault = true;
type C = typeof Colors.dark;

// ==================== Button ====================
interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title, variant = 'primary', size = 'md', loading, icon, fullWidth, style, disabled, ...props
}: ButtonProps) {
  const colors = Colors.dark;
  const bg = variant === 'primary' ? colors.primary
    : variant === 'danger' ? colors.danger
    : variant === 'secondary' ? colors.surface2
    : 'transparent';
  const fg = variant === 'primary' ? '#fff'
    : variant === 'danger' ? '#fff'
    : variant === 'ghost' ? colors.text
    : variant === 'link' ? colors.primary
    : colors.text;
  const h = size === 'sm' ? 34 : size === 'lg' ? 50 : 42;
  const fontSize = size === 'sm' ? FS.sm : size === 'lg' ? FS.lg : FS.md;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      style={[
        {
          height: h, borderRadius: BR.md, backgroundColor: bg,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: size === 'sm' ? 14 : 20,
          opacity: disabled ? 0.5 : 1,
          ...(variant === 'secondary' ? { borderWidth: 1, borderColor: colors.border } : {}),
        },
        fullWidth && { width: '100%' },
        style as ViewStyle,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} style={{ marginRight: icon || title ? 6 : 0 }} />
      ) : icon ? (
        <View style={{ marginRight: 6 }}>{icon}</View>
      ) : null}
      <Text style={{ color: fg, fontSize, fontWeight: '600' }}>{title}</Text>
    </TouchableOpacity>
  );
}

// ==================== Input ====================
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label, error, hint, leftIcon, rightIcon, onRightIconPress,
  style, ...props
}: InputProps) {
  const colors = Colors.dark;
  return (
    <View style={{ marginBottom: 16 }}>
      {label && (
        <Text style={{ color: colors.text, fontSize: FS.sm, fontWeight: '500', marginBottom: 6 }}>
          {label}
        </Text>
      )}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: BR.md,
        borderWidth: 1, borderColor: error ? colors.danger : colors.border,
        paddingHorizontal: 12, height: 46,
      }}>
        {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
        <TextInput
          style={[
            {
              flex: 1, color: colors.text, fontSize: FS.md,
              height: '100%',
            },
            style as TextStyle,
          ]}
          placeholderTextColor={colors.textTertiary}
          {...props}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={{ padding: 4 }}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={{ color: colors.danger, fontSize: FS.xs, marginTop: 4 }}>{error}</Text>
      )}
      {hint && !error && (
        <Text style={{ color: colors.textTertiary, fontSize: FS.xs, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
}

// ==================== Card ====================
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
}

export function Card({ children, style, onPress, padded = true }: CardProps) {
  const colors = Colors.dark;
  const content = (
    <View style={[{
      backgroundColor: colors.surface, borderRadius: BR.lg,
      borderWidth: 1, borderColor: colors.border,
      padding: padded ? 16 : 0, overflow: 'hidden',
    }, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

// ==================== Sheet (Bottom Sheet Modal) ====================
interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showHandle?: boolean;
}

export function Sheet({ visible, onClose, title, children, showHandle = true }: SheetProps) {
  const colors = Colors.dark;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <View style={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: BR.xl, borderTopRightRadius: BR.xl,
        paddingBottom: 34, maxHeight: Dimensions.get('window').height * 0.7,
      }}>
        {showHandle && (
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </View>
        )}
        {title && (
          <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: FS.lg, fontWeight: '700' }}>{title}</Text>
          </View>
        )}
        <ScrollView bounces={false} style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ==================== Badge ====================
interface BadgeProps {
  label: string;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color, bgColor, size = 'sm' }: BadgeProps) {
  const colors = Colors.dark;
  return (
    <View style={{
      backgroundColor: bgColor || colors.primaryBg,
      borderRadius: BR.full,
      paddingHorizontal: size === 'sm' ? 8 : 10,
      paddingVertical: size === 'sm' ? 2 : 4,
      alignSelf: 'flex-start',
    }}>
      <Text style={{
        color: color || colors.primary,
        fontSize: size === 'sm' ? FS.xs : FS.sm,
        fontWeight: '600',
      }}>{label}</Text>
    </View>
  );
}

// ==================== Avatar ====================
interface AvatarProps {
  uri?: string;
  name?: string;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const colors = Colors.dark;
  const initials = name ? name.slice(0, 2).toUpperCase() : '?';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.primaryBg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: colors.primary, fontSize: size * 0.38, fontWeight: '700' }}>
        {initials}
      </Text>
    </View>
  );
}

// ==================== Divider ====================
export function Divider({ margin = 16 }: { margin?: number }) {
  return (
    <View style={{
      height: 1, backgroundColor: Colors.dark.border,
      marginVertical: margin,
    }} />
  );
}

// ==================== Skeleton ====================
export function Skeleton({ width, height, borderRadius = BR.md, style }:
  { width?: any; height?: number; borderRadius?: number; style?: ViewStyle }) {
  const colors = Colors.dark;
  return (
    <View style={[{
      backgroundColor: colors.surface2, borderRadius,
      width: width || '100%', height: height || 20,
    }, style]} />
  );
}

// ==================== EmptyState ====================
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const colors = Colors.dark;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      {icon && <Text style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Text>}
      <Text style={{ color: colors.text, fontSize: FS.lg, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
        {title}
      </Text>
      {description && (
        <Text style={{ color: colors.textSecondary, fontSize: FS.sm, textAlign: 'center', lineHeight: 20 }}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={{ marginTop: 20 }} />
      )}
    </View>
  );
}

// ==================== ErrorBoundary ====================
interface ErrorBoundaryState { hasError: boolean; error?: Error }
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Colors.dark.bg, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ color: Colors.dark.text, fontSize: FS.lg, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
            出了点问题
          </Text>
          <Text style={{ color: Colors.dark.textSecondary, fontSize: FS.sm, textAlign: 'center' }}>
            应用遇到了意外错误，请重启应用
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}
