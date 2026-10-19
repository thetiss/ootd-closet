import dayjs from 'dayjs';

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatDate(dateStr: string, fmt = 'MM-DD'): string {
  return dayjs(dateStr).format(fmt);
}

export function formatWeekday(dateStr: string): string {
  return WEEK_LABELS[dayjs(dateStr).day()];
}

export function formatDateTime(ts: number): string {
  return dayjs(ts).format('YYYY-MM-DD HH:mm');
}

export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function next7DaysISO(): string[] {
  const arr: string[] = [];
  for (let i = 0; i < 7; i++) {
    arr.push(dayjs().add(i, 'day').format('YYYY-MM-DD'));
  }
  return arr;
}
