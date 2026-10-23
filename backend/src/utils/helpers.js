export function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function normalizeKey(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
