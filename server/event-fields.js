function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function cleanText(value, maxLength = 4000) {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, maxLength);
}

function optionalDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return undefined;
}

function optionalTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value;
  return undefined;
}

function optionalId(value) {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

module.exports = { hasOwn, cleanText, optionalDate, optionalTime, optionalId };
