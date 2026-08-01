import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert from '../components/CustomAlert';

const AlertContext = createContext(null);

const ERROR_HINTS = ['fail', 'error', 'declin', 'reject', 'incorrect', 'invalid', 'insufficient', 'could not', "couldn't", 'wrong', 'denied', 'unable'];
const SUCCESS_HINTS = ['success', 'saved', 'sent!', 'complete', 'confirmed', 'updated', 'disbursed', 'received', 'repaid', 'copied', 'created'];
const WARNING_HINTS = ['warning', 'careful', 'sure?', 'pending', 'expire', 'limited', 'caution'];
const CONFIRM_HINTS = ['confirm', 'are you sure', 'cancel', 'remove', 'delete', 'logout', 'log out', 'proceed'];

function guessType(title = '', message = '', buttons = []) {
  const haystack = `${title} ${message}`.toLowerCase();
  const hasDestructiveButton = buttons.some((b) => b.style === 'destructive');
  if (hasDestructiveButton || CONFIRM_HINTS.some((h) => haystack.includes(h))) return 'confirm';
  if (ERROR_HINTS.some((h) => haystack.includes(h))) return 'error';
  if (SUCCESS_HINTS.some((h) => haystack.includes(h))) return 'success';
  if (WARNING_HINTS.some((h) => haystack.includes(h))) return 'warning';
  return 'info';
}

export function AlertProvider({ children }) {
  const [state, setState] = useState({ visible: false, title: '', message: '', buttons: [], type: 'info' });

  // Signature-compatible with React Native's Alert.alert(title, message, buttons, options).
  // `options.type` can override the auto-detected icon/color ('success' | 'error' | 'warning' | 'info' | 'confirm').
  const alert = useCallback((title, message, buttons, options) => {
    const resolvedButtons = buttons || [{ text: 'OK' }];
    const type = options?.type || guessType(title, message, resolvedButtons);
    setState({ visible: true, title, message, buttons: resolvedButtons, type });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <AlertContext.Provider value={{ alert }}>
      {children}
      <CustomAlert
        visible={state.visible}
        title={state.title}
        message={state.message}
        buttons={state.buttons}
        type={state.type}
        onRequestClose={close}
      />
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
}
