function nowIso() {
  return new Date().toISOString();
}

function toIsoDate(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const date = new Date(value);
  if ( Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date or timestamp.`);
  }

  return date.toISOString();
}

module.exports = {
  nowIso,
  toIsoDate,
};
