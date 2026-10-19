// 备份：JSON 导出 / 导入（阶段 7）
// - 导出为 data URL 供 <a download> 用
// - 导入支持 merge（保留旧数据、追加以不同 id 的新数据）
// - Blobs（items.imageFull/Thumb）原样进 JSON（会较大，UI 层会提示用户）
import { db } from '@/db';
import type { Item, Look, Settings, WeekSchedule } from '@/types';
import { DEFAULT_USER_ID, defaultSettings, defaultWeekSchedule } from '@/utils/constants';

const SCHEMA_VERSION = 1;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  app: string;
  data: {
    settings: Settings | null;
    schedule: WeekSchedule | null;
    items: Item[];
    looks: Look[];
  };
}

export async function exportAllData(): Promise<BackupPayload> {
  const [settings, schedule, items, looks] = await Promise.all([
    db.settings.get(DEFAULT_USER_ID),
    db.schedule.get(DEFAULT_USER_ID),
    db.items.where('userId').equals(DEFAULT_USER_ID).toArray(),
    db.looks.where('userId').equals(DEFAULT_USER_ID).toArray(),
  ]);
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ootd-closet',
    data: {
      settings: settings ?? defaultSettings(),
      schedule: schedule ?? defaultWeekSchedule(),
      items,
      looks,
    },
  };
}

export function downloadBackup(payload: BackupPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ootd-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportResult {
  items: number;
  looks: number;
  settings: boolean;
  schedule: boolean;
  errors: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isItemShape(v: unknown): v is Item {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    typeof v.category === 'string' &&
    Array.isArray(v.scenes) &&
    Array.isArray(v.tempBands)
  );
}

function isLookShape(v: unknown): v is Look {
  if (!isRecord(v)) return false;
  return (
    typeof v.id === 'string' &&
    Array.isArray(v.items) &&
    (v.source === 'recommendation' || v.source === 'manual')
  );
}

export async function importAllData(
  json: string,
  opts: { mode?: 'merge' | 'replace' } = {},
): Promise<ImportResult> {
  const mode = opts.mode ?? 'merge';
  const errors: string[] = [];
  const result: ImportResult = { items: 0, looks: 0, settings: false, schedule: false, errors };

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    return { ...result, errors: [`JSON 解析失败：${err instanceof Error ? err.message : '未知错误'}`] };
  }

  if (!isRecord(parsed)) {
    return { ...result, errors: ['备份格式错误：不是对象'] };
  }
  if (parsed.app !== 'ootd-closet') {
    errors.push('备份不属于 ootd-closet');
  }
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion 不匹配（期望 ${SCHEMA_VERSION}）`);
  }

  const data = isRecord(parsed.data) ? parsed.data : {};
  const itemsRaw = Array.isArray(data.items) ? data.items : [];
  const looksRaw = Array.isArray(data.looks) ? data.looks : [];
  const settingsRaw = data.settings;
  const scheduleRaw = data.schedule;

  if (mode === 'replace') {
    await db.transaction('rw', [db.items, db.looks, db.settings, db.schedule], async () => {
      await db.items.where('userId').equals(DEFAULT_USER_ID).delete();
      await db.looks.where('userId').equals(DEFAULT_USER_ID).delete();
      await db.settings.clear();
      await db.schedule.clear();
    });
  }

  const validItems = itemsRaw.filter(isItemShape).map((it) => ({ ...it, userId: DEFAULT_USER_ID }));
  const validLooks = looksRaw.filter(isLookShape).map((lk) => ({ ...lk, userId: DEFAULT_USER_ID }));

  await db.transaction('rw', [db.items, db.looks, db.settings, db.schedule], async () => {
    for (const it of validItems) {
      await db.items.put(it);
      result.items += 1;
    }
    for (const lk of validLooks) {
      await db.looks.put(lk);
      result.looks += 1;
    }
    if (isRecord(settingsRaw) && typeof settingsRaw.id === 'string') {
      const s: Settings = {
        id: DEFAULT_USER_ID,
        city: (settingsRaw.city as Settings['city']) ?? defaultSettings().city,
        customTempBands: Array.isArray(settingsRaw.customTempBands) ? (settingsRaw.customTempBands as number[]) : [],
        customScenes: Array.isArray(settingsRaw.customScenes) ? (settingsRaw.customScenes as string[]) : [],
        coolDownDays: typeof settingsRaw.coolDownDays === 'number' ? settingsRaw.coolDownDays : 7,
      };
      await db.settings.put(s);
      result.settings = true;
    }
    if (isRecord(scheduleRaw) && typeof scheduleRaw.id === 'string') {
      const dflt = defaultWeekSchedule();
      const sc: WeekSchedule = {
        id: DEFAULT_USER_ID,
        monday: (scheduleRaw.monday as string) ?? dflt.monday,
        tuesday: (scheduleRaw.tuesday as string) ?? dflt.tuesday,
        wednesday: (scheduleRaw.wednesday as string) ?? dflt.wednesday,
        thursday: (scheduleRaw.thursday as string) ?? dflt.thursday,
        friday: (scheduleRaw.friday as string) ?? dflt.friday,
        saturday: (scheduleRaw.saturday as string) ?? dflt.saturday,
        sunday: (scheduleRaw.sunday as string) ?? dflt.sunday,
      };
      await db.schedule.put(sc);
      result.schedule = true;
    }
  });

  return result;
}

export function readBackupFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('文件读取失败'));
    r.onload = () => resolve(String(r.result ?? ''));
    r.readAsText(file);
  });
}
