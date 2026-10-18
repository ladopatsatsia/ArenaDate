import { Button, Text, TextInput } from '../components/UI';
import { pendingStore } from "../chat/storage";
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Modal, ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from '../components/useReducedMotion';
import { theme } from '../components/theme';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { SafetyApi,safetyRevoked,type SafetyInput } from './api';
export function SafetyActions({
  targetId,
  conversationId,
  messageId,
  initialAction,
  isOpen: externalOpen,
  onClose: externalOnClose,
  unblock = false,
  closed = false,
  onDone,
  variant = 'button',
  size = 'md',
}: {
  targetId?: string;
  conversationId?: string;
  messageId?: string;
  initialAction?: SafetyInput['action'];
  isOpen?: boolean;
  onClose?: () => void;
  unblock?: boolean;
  closed?: boolean;
  onDone?: (action: SafetyInput['action']) => void;
  variant?: 'button' | 'dots' | 'hidden';
  size?: 'sm' | 'md';
}) {
  const { api: auth, manager, state } = useAuth();
  const account = state.account!.id;
  const { t } = useTranslation();
  const cache = useQueryClient();
  const reduced = useReducedMotion();
  const api = useMemo(() => new SafetyApi(auth, manager), [auth, manager, account]);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;

  const [action, setAction] = useState<SafetyInput['action'] | null>(
    initialAction ?? (unblock ? 'unblock' : null)
  );
  const [report, setReport] = useState(initialAction === 'report');
  const [kind, setKind] = useState<'profile' | 'message'>(messageId ? 'message' : 'profile');
  const [category, setCategory] = useState('harassment');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState<SafetyInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const lock = useRef(false);

  useEffect(() => {
    if (externalOpen) {
      setAction(initialAction ?? (unblock ? 'unblock' : null));
      setReport(initialAction === 'report');
      setKind(messageId ? 'message' : 'profile');
      setNotice('');
    }
  }, [externalOpen, initialAction, unblock, messageId]);

  const handleOpen = () => {
    setAction(initialAction ?? (unblock ? 'unblock' : null));
    setReport(initialAction === 'report');
    setNotice('');
    setInternalOpen(true);
  };

  const handleClose = () => {
    if (busy) return;
    setInternalOpen(false);
    externalOnClose?.();
  };

  async function confirm() {
    if (lock.current) return;
    const effectiveAction = action ?? 'report';
    lock.current = true;
    setBusy(true);
    setNotice('');
    const input =
      pending ?? {
        requestId: Crypto.randomUUID(),
        action: effectiveAction,
        targetId,
        conversationId,
        report: report
          ? {
              kind,
              category,
              description,
              messageId: kind === 'message' ? messageId : undefined,
            }
          : undefined,
      };
    setPending(input);
    try {
      await api.execute(input);
      if (manager.snapshot().account?.id !== account) return;
      if (input.action === 'block' || input.action === 'unmatch') {
        if (conversationId) safetyRevoked(account, conversationId);
        await cache.cancelQueries({ queryKey: ['account', account] });
        await cache.resetQueries({ queryKey: ['account', account] });
        if (conversationId) await pendingStore(account, conversationId, auth.baseUrl).save(null);
      } else await cache.invalidateQueries({ queryKey: ['account', account] });
      setPending(null);
      handleClose();
      setNotice('safety_saved');
      onDone?.(input.action);
    } catch (error) {
      if (manager.snapshot().account?.id === account) {
        const definite = error instanceof ApiError && [400, 401, 403, 404, 409, 429].includes(error.status);
        if (definite) setPending(null);
        setNotice(definite ? 'safety_failed' : 'safety_uncertain');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const disabled = busy || !!pending;
  const availableActions = unblock
    ? (['unblock'] as const)
    : closed
    ? (['report', 'block'] as const)
    : conversationId
    ? (['report', 'block', 'unmatch'] as const)
    : (['report', 'block'] as const);

  return (
    <View>
      {variant === 'dots' ? (
        <Pressable
          testID="safety-open"
          accessibilityRole="button"
          accessibilityLabel={t(unblock ? 'safety_unblock' : 'safety_actions')}
          onPress={handleOpen}
          hitSlop={8}
          style={({ pressed }) => [styles.dotsButton, size === 'sm' && styles.dotsButtonSm, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.dotsText, size === 'sm' && styles.dotsTextSm]}>⋮</Text>
        </Pressable>
      ) : variant === 'hidden' ? null : (
        <Button testID="safety-open" title={t(unblock ? 'safety_unblock' : 'safety_actions')} onPress={handleOpen} />
      )}
      {!open && !!notice && <Text accessibilityRole="alert">{t(notice)}</Text>}
      <Modal visible={open} animationType={reduced ? 'none' : 'slide'} onRequestClose={handleClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ padding: 20, gap: 12 }}
              accessibilityViewIsModal
            >
              <Text accessibilityRole="header">{t('safety_actions')}</Text>
              <Text>{t('safety_privacy')}</Text>

              {availableActions.map((value) => (
                <Button
                  key={value}
                  disabled={disabled}
                  title={(action === value ? '✓ ' : '') + t('safety_' + value)}
                  onPress={() => {
                    setAction(value);
                    setReport(value === 'report');
                  }}
                />
              ))}

              {action !== null && action !== 'report' && action !== 'unblock' && (
                <Button
                  disabled={disabled}
                  title={t(report ? 'safety_remove_report' : 'safety_add_report')}
                  onPress={() => setReport(!report)}
                />
              )}

              {report && (
                <>
                  {conversationId && !messageId && (
                    <Button
                      disabled={disabled}
                      title={t(kind === 'profile' ? 'safety_recent' : 'safety_profile')}
                      onPress={() => setKind(kind === 'profile' ? 'message' : 'profile')}
                    />
                  )}
                  <Text>{t(kind === 'message' ? 'safety_recent_note' : 'safety_profile')}</Text>
                  {['harassment', 'spam', 'impersonation', 'underage', 'sexual_content', 'other'].map((value) => (
                    <Button
                      key={value}
                      disabled={disabled}
                      title={(category === value ? '✓ ' : '') + t('safety_category_' + value)}
                      onPress={() => setCategory(value)}
                    />
                  ))}
                  <TextInput
                    accessibilityLabel={t('safety_description')}
                    placeholder={t('safety_description')}
                    multiline
                    maxLength={1000}
                    editable={!disabled}
                    value={description}
                    onChangeText={setDescription}
                    style={{ borderWidth: 1, padding: 12 }}
                  />
                </>
              )}

              {action !== null && <Text>{t('safety_confirm_' + action)}</Text>}
              {!!notice && <Text accessibilityRole="alert">{t(notice)}</Text>}
              <Button
                testID="safety-confirm"
                variant="danger"
                disabled={busy}
                title={t(pending ? 'retry' : 'safety_confirm')}
                onPress={() => {
                  void confirm();
                }}
              />
              <Button disabled={busy} title={t('back')} onPress={handleClose} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dotsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsButtonSm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  dotsText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 22,
    textAlign: 'center',
  },
  dotsTextSm: {
    fontSize: 18,
    lineHeight: 20,
    color: theme.colors.muted,
  },
});

