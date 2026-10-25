import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateBookingId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `BK-${num}`;
}

export function generateSku(description: string): string {
  const words = description.toUpperCase().split(/\s+/).slice(0, 2);
  const prefix = words.map(w => w.slice(0, 3)).join('-') || 'ITM';
  const num = String(Math.floor(Math.random() * 90) + 10);
  return `${prefix}-${num}`;
}

export function formatCurrency(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

export function parseUKDate(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const d = new Date(year, month - 1, day);
  if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) return null;
  return d;
}
