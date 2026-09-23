import dayjs from 'dayjs';

export function formatKes(value) {
  return `KSh ${Number(value || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return '—';
  return dayjs(value).format('DD MMM YYYY');
}

export function formatDateTime(value) {
  if (!value) return '—';
  return dayjs(value).format('DD MMM YYYY, HH:mm');
}

export function formatRelative(value) {
  if (!value) return '—';
  const d = dayjs(value);
  const today = dayjs();
  if (d.isSame(today, 'day')) return 'Today';
  const days = today.startOf('day').diff(d.startOf('day'), 'day');
  if (days === 1) return '1 day ago';
  if (days > 1 && days < 7) return `${days} ago`;
  if (days >= 7 && days < 30) return `${Math.floor(days / 7)} wk ago`;
  return d.format('DD MMM YYYY');
}

export const BUSINESS_TYPES = [
  { value: 'shoe_repair', label: 'Shoe Repair' },
  { value: 'phone_repair', label: 'Phone Repair' },
  { value: 'tailor', label: 'Tailor' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'cyber_cafe', label: 'Cyber Cafe' },
  { value: 'salon', label: 'Salon' },
  { value: 'other', label: 'Other' },
];
