import Dexie from 'dexie';
import type {
  Item,
  Look,
  Cooldown,
  Settings,
  WeekSchedule,
} from '@/types';

type Table<T, K> = Dexie.Table<T, K>;

class OotdDB extends Dexie {
  items!: Table<Item, string>;
  looks!: Table<Look, string>;
  cooldowns!: Table<Cooldown, string>;
  settings!: Table<Settings, string>;
  schedule!: Table<WeekSchedule, string>;

  constructor() {
    super('ootd-closet');
    this.version(1).stores({
      items: 'id, userId, category, createdAt',
      looks: 'id, userId, createdAt, source',
      cooldowns: 'itemId, until',
      settings: 'id',
      schedule: 'id',
    });
  }
}

export const db = new OotdDB();
