/**
 * Browser half of dsh-plugin-always-on-top.
 *
 * Registers one pin button in the composer, immediately to the right of the
 * source-control trigger. The button reads and writes the Electron window level
 * through the Host's loopback route; the Host half owns the inspector bridge.
 *
 * This file is the source; `scripts/build-client.mjs` bundles it into the
 * plugin's `client.js` so the page can load it through the module loader.
 */

import * as React from 'react';

const h = React.createElement;

const NS = 'dsh-always-on-top';
const ROUTE = '/__dsh/always-on-top';

const EN = {
  title: 'Always on top',
  active: 'Always on top is on. Click to turn it off.',
  inactive: 'Always on top is off. Click to keep DeepSeek Harness above other windows.',
  busy: 'Changing the window…',
  unsupported: 'Always on top is only available in the DeepSeek Harness desktop app.',
  unsupportedFuse: 'This DeepSeek Harness build does not allow window debugging, so the pin is unavailable.',
  unsupportedRuntime: 'This DeepSeek Harness runtime is too old for the window channel.',
  unsupportedPlatform: 'Window pinning is not supported on this platform yet.',
  error: 'Could not change the window. Click to try again.',
  stateFailed: 'Could not read the window state. Click to try again.',
};

const ZH = {
  title: '窗口置顶',
  active: '窗口已置顶。点击取消。',
  inactive: '窗口未置顶。点击让 DeepSeek Harness 始终显示在其他窗口上方。',
  busy: '正在调整窗口…',
  unsupported: '窗口置顶仅在 DeepSeek Harness 桌面应用中可用。',
  unsupportedFuse: '此 DeepSeek Harness 构建未启用窗口调试，无法使用置顶。',
  unsupportedRuntime: '此 DeepSeek Harness 运行时版本过旧，不支持窗口通道。',
  unsupportedPlatform: '此平台暂不支持窗口置顶。',
  error: '无法调整窗口。点击重试。',
  stateFailed: '无法读取窗口状态。点击重试。',
};

const STYLES = `
.dshat-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0 1px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease, opacity 100ms ease;
}
.dshat-trigger:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.dshat-trigger:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dshat-trigger[data-active='true'] {
  color: var(--dsw-alias-label-primary, #ffffff);
}
.dshat-trigger[data-active='true']:hover {
  color: var(--dsw-alias-label-primary, #ffffff);
}
.dshat-trigger[data-busy='true'] {
  opacity: 0.55;
  cursor: progress;
}
.dshat-trigger[data-unsupported='true'] {
  opacity: 0.45;
  cursor: not-allowed;
}
.dshat-trigger svg {
  display: block;
  width: 15px;
  height: 15px;
}
`;

function ensureStyles() {
  if (typeof document === 'undefined') return () => {};
  const style = document.createElement('style');
  style.dataset.dshAlwaysOnTop = '';
  style.textContent = STYLES;
  document.head.appendChild(style);
  return () => {
    style.remove();
  };
}

function useTranslate(ctx) {
  const [, bump] = React.useReducer((value) => value + 1, 0);
  React.useEffect(() => ctx.locale.subscribe(bump), [ctx]);
  const translate = React.useMemo(() => ctx.locale.bind(NS), [ctx]);
  return React.useCallback(
    (key) => {
      let value;
      try {
        value = translate(key);
      } catch {
        value = key;
      }
      if (typeof value !== 'string' || value === key) return EN[key] ?? key;
      return value;
    },
    [translate],
  );
}

function PinIcon({ active }) {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 15,
      height: 15,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
    },
    h('path', {
      d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
      fill: active === true ? 'currentColor' : 'none',
    }),
    h('path', { d: 'M12 17v5', fill: 'none' }),
  );
}

/**
 * Normalize one route response. `supported: false` is a valid answer, not an
 * error: the button renders disabled with an explanation.
 *
 * @param response - Fetch response.
 * @returns `{ supported, alwaysOnTop?, reason?, error? }`.
 */
async function readResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    return { supported: true, error: 'unreadable' };
  }
  if (data !== null && typeof data === 'object' && data.supported === false) {
    return { supported: false, reason: typeof data.reason === 'string' ? data.reason : '' };
  }
  if (!response.ok || data === null || typeof data !== 'object' || data.ok !== true) {
    return { supported: true, error: data && typeof data.error === 'string' ? data.error : 'request-failed' };
  }
  return { supported: true, alwaysOnTop: data.alwaysOnTop === true };
}

async function getState(signal) {
  try {
    const response = await fetch(ROUTE, { method: 'GET', cache: 'no-store', signal });
    return await readResponse(response);
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    return { supported: true, error: 'network' };
  }
}

async function setState(alwaysOnTop) {
  try {
    const response = await fetch(ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alwaysOnTop }),
      cache: 'no-store',
    });
    return await readResponse(response);
  } catch {
    return { supported: true, error: 'network' };
  }
}

const UNSUPPORTED_KEYS = {
  'desktop-only': 'unsupported',
  'inspect-disabled': 'unsupportedFuse',
  'inspect-unknown': 'unsupportedFuse',
  'runtime-too-old': 'unsupportedRuntime',
  'unsupported-platform': 'unsupportedPlatform',
};

function unsupportedLabel(translate, reason) {
  return translate(UNSUPPORTED_KEYS[reason] ?? 'unsupported');
}

function PinTrigger(props) {
  const translate = useTranslate(props.clientCtx);
  const [state, setLocal] = React.useState({
    phase: 'loading',
    supported: true,
    alwaysOnTop: false,
    known: false,
    error: '',
    reason: '',
  });
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    getState(controller.signal).then((result) => {
      if (!alive) return;
      if (!result.supported) {
        setLocal({ phase: 'unsupported', supported: false, alwaysOnTop: false, known: false, error: '', reason: result.reason ?? '' });
        return;
      }
      if (result.error) {
        setLocal({ phase: 'error', supported: true, alwaysOnTop: false, known: false, error: result.error });
        return;
      }
      setLocal({
        phase: 'idle',
        supported: true,
        alwaysOnTop: result.alwaysOnTop === true,
        known: true,
        error: '',
      });
    }).catch((error) => {
      if (!alive || (error && error.name === 'AbortError')) return;
      setLocal({ phase: 'error', supported: true, alwaysOnTop: false, known: false, error: 'network' });
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const refresh = React.useCallback(async () => {
    setLocal((current) => ({ ...current, phase: 'busy', error: '' }));
    const result = await getState();
    if (!result.supported) {
      setLocal({ phase: 'unsupported', supported: false, alwaysOnTop: false, known: false, error: '', reason: result.reason ?? '' });
      return;
    }
    if (result.error) {
      setLocal({ phase: 'error', supported: true, alwaysOnTop: false, known: false, error: result.error });
      return;
    }
    setLocal({
      phase: 'idle',
      supported: true,
      alwaysOnTop: result.alwaysOnTop === true,
      known: true,
      error: '',
    });
  }, []);

  const toggle = React.useCallback(async () => {
    const current = stateRef.current;
    if (current.phase === 'loading' || current.phase === 'busy' || current.phase === 'unsupported') return;
    if (!current.known) {
      await refresh();
      return;
    }
    const next = !current.alwaysOnTop;
    setLocal({ ...current, phase: 'busy', error: '' });
    const result = await setState(next);
    if (!result.supported) {
      setLocal({ phase: 'unsupported', supported: false, alwaysOnTop: false, known: false, error: '', reason: result.reason ?? '' });
      return;
    }
    if (result.error) {
      // Keep the last confirmed value so the icon does not lie about the window.
      setLocal({ ...current, phase: 'error', error: result.error });
      return;
    }
    setLocal({
      phase: 'idle',
      supported: true,
      alwaysOnTop: result.alwaysOnTop === true,
      known: true,
      error: '',
    });
  }, [refresh]);

  const active = state.supported && state.alwaysOnTop;
  let label;
  if (state.phase === 'unsupported') label = unsupportedLabel(translate, state.reason);
  else if (state.phase === 'busy') label = translate('busy');
  else if (state.phase === 'error') {
    label = translate(state.known ? 'error' : 'stateFailed');
  } else if (state.phase === 'loading') label = translate('busy');
  else label = translate(active ? 'active' : 'inactive');

  const blocked = state.phase === 'unsupported' || state.phase === 'loading' || state.phase === 'busy';

  return h(
    'button',
    {
      type: 'button',
      className: 'dshat-trigger',
      onClick: () => {
        if (!blocked) toggle();
      },
      'aria-label': label,
      'aria-pressed': active,
      'aria-disabled': blocked ? 'true' : 'false',
      title: label,
      'data-active': active ? 'true' : 'false',
      'data-busy': state.phase === 'busy' || state.phase === 'loading' ? 'true' : 'false',
      'data-unsupported': state.phase === 'unsupported' ? 'true' : 'false',
    },
    h(PinIcon, { active }),
  );
}

export const inject = ['slots', 'locale'];

export function apply(ctx) {
  const t = ctx.locale.bind(NS);
  const Pin = (props) => h(PinTrigger, { ...props, clientCtx: ctx });

  ctx.effect(() => ensureStyles(), 'always-on-top: styles');
  ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'always-on-top: en locale');
  ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'always-on-top: zh locale');
  ctx.effect(
    () =>
      ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.right',
            id: 'always-on-top',
            // The source-control trigger uses 10 and the backlog trigger uses 11.
            // 10.5 keeps the pin immediately to the right of source control.
            order: 10.5,
            label: () => t('title'),
          },
          Pin,
        ),
      ),
    'always-on-top: composer trigger',
  );
}
