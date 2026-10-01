import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';

export interface ConfirmOptions {
  title: string;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type DialogRenderer = (close: () => void) => ReactNode;

interface DialogApi {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  open: (render: DialogRenderer) => () => void;
}

const DialogContext = createContext<DialogApi>({ confirm: async () => false, open: () => () => {} });

export function useDialogs(): DialogApi {
  return useContext(DialogContext);
}

interface Entry {
  id: number;
  render: DialogRenderer;
}

let counter = 0;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  const open = useCallback((render: DialogRenderer) => {
    const id = ++counter;
    setEntries((list) => [...list, { id, render }]);
    return () => setEntries((list) => list.filter((e) => e.id !== id));
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const close = open((closeSelf) => (
          <ConfirmDialog
            options={options}
            onResult={(ok) => {
              closeSelf();
              resolve(ok);
            }}
          />
        ));
        void close;
      }),
    [open],
  );

  const api = useMemo(() => ({ confirm, open }), [confirm, open]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {entries.map((e) => (
        <Overlay key={e.id} onClose={() => setEntries((list) => list.filter((x) => x.id !== e.id))}>
          {e.render(() => setEntries((list) => list.filter((x) => x.id !== e.id)))}
        </Overlay>
      ))}
    </DialogContext.Provider>
  );
}

function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay overlay--center" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

function ConfirmDialog({ options, onResult }: { options: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="dialog__title">
        {options.title}
      </h2>
      {options.text && <div className="dialog__text">{options.text}</div>}
      <div className="dialog__actions dialog__actions--row">
        <button type="button" className="btn btn--tonal" onClick={() => onResult(false)}>
          {options.cancelLabel ?? t('cancel')}
        </button>
        <button type="button" className={`btn ${options.danger ? 'btn--danger' : 'btn--primary'}`} onClick={() => onResult(true)} autoFocus>
          {options.confirmLabel ?? t('ok')}
        </button>
      </div>
    </div>
  );
}
