// Local-date helpers. Dates are stored as 'YYYY-MM-DD' in the user's time zone.

export const pad = (n) => String(n).padStart(2, '0');

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};

// Whole days between two dates (b - a), ignoring time of day.
export const daysBetween = (a, b) => {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
};

// ISO weekday: 1 = Monday … 7 = Sunday.
export const isoDay = (d) => d.getDay() || 7;

export const weekStart = (d) => addDays(d, 1 - isoDay(d));
