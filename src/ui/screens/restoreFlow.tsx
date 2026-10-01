import type { useDialogs } from '../../app/dialogs';
import type { useToast } from '../../app/toast';
import { BackupError, parseBackup, restoreBackup } from '../../data/backup';
import type { FinanceDB } from '../../data/db';
import { markBackupDone } from '../../data/maintenance';
import type { Clock } from '../../domain/dates';
import type { I18n } from '../../i18n';

interface Deps {
  db: FinanceDB;
  clock: Clock;
  dialogs: ReturnType<typeof useDialogs>;
  toast: ReturnType<typeof useToast>;
  t: I18n['t'];
}

/** Validates a backup file completely, shows the summary, asks for confirmation, then replaces all data. */
export function useRestoreFlow({ db, clock, dialogs, toast, t }: Deps): (file: File) => Promise<boolean> {
  return async (file: File) => {
    let parsed;
    try {
      parsed = await parseBackup(file);
    } catch (e) {
      const detail = e instanceof BackupError && e.code === 'invalid' ? t('restoreErrorInvalid', { detail: e.message }) : t('restoreErrorNotZip');
      await dialogs.confirm({ title: t('restoreErrorTitle'), text: detail, confirmLabel: t('ok') });
      return false;
    }
    const ok = await dialogs.confirm({
      title: t('restoreTitle'),
      text: t('restoreSummary', { tx: parsed.summary.transactions, cat: parsed.summary.categories, img: parsed.summary.attachments }),
      confirmLabel: t('restoreConfirm'),
      danger: true,
    });
    if (!ok) return false;
    try {
      await restoreBackup(db, parsed);
      await markBackupDone(db, clock);
      toast.show(t('restoreDone'));
      return true;
    } catch (e) {
      await dialogs.confirm({ title: t('restoreErrorTitle'), text: e instanceof Error ? e.message : String(e), confirmLabel: t('ok') });
      return false;
    }
  };
}
