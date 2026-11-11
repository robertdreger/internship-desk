export const STORAGE_KEY = "internship-desk.records.v1";
const stringFields = [
  "id",
  "type",
  "company",
  "title",
  "category",
  "focus",
  "location",
  "region",
  "timing",
  "evidence",
  "deadline",
  "assessmentDeadline",
  "deadlineBasis",
  "cv",
  "status",
  "stage",
  "appliedAt",
  "followup",
  "interviewDate",
  "offerDeadline",
  "contact",
  "notes",
  "nextAction",
  "checkedAt",
  "source",
  "personalNotes",
];
const dates = [
  "deadline",
  "assessmentDeadline",
  "appliedAt",
  "followup",
  "interviewDate",
  "offerDeadline",
  "checkedAt",
];
export function validateRecords(value, template) {
  if (!Array.isArray(value) || value.length > 2000)
    throw Error("Expected a JSON backup with up to 2,000 opportunities.");
  const ids = new Set();
  return value.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw Error("Invalid opportunity in backup.");
    const record = {};
    for (const key of stringFields) {
      const v = raw[key] ?? template[key] ?? "";
      if (typeof v !== "string" || v.length > 20000)
        throw Error("Invalid field: " + key);
      record[key] = v;
    }
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(record.id) || ids.has(record.id))
      throw Error("Backup has invalid or duplicate IDs.");
    ids.add(record.id);
    if (
      !record.company.trim() ||
      !record.title.trim() ||
      !["summer", "spring"].includes(record.type)
    )
      throw Error("Each opportunity needs a company, title and valid type.");
    for (const key of dates) {
      const v = record[key];
      if (
        v &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          Number.isNaN(Date.parse(v + "T12:00:00Z")) ||
          new Date(v + "T12:00:00Z").toISOString().slice(0, 10) !== v)
      )
        throw Error("Invalid date: " + key);
    }
    if (record.source && !/^https?:\/\//i.test(record.source))
      throw Error("Source URLs must use http or https.");
    for (const key of ["priority", "archived"]) {
      if (raw[key] !== undefined && typeof raw[key] !== "boolean")
        throw Error("Invalid " + key);
      record[key] = raw[key] ?? false;
    }
    if (
      raw.revision !== undefined &&
      (!Number.isInteger(raw.revision) || raw.revision < 0)
    )
      throw Error("Invalid record version.");
    record.revision = raw.revision ?? 0;
    return record;
  });
}
export function loadRecords(storage, demo) {
  const raw = storage.getItem(STORAGE_KEY);
  return validateRecords(raw === null ? demo : JSON.parse(raw), demo[0]);
}
export function saveRecord(storage, item, demo) {
  const records = loadRecords(storage, demo);
  const existing = records.find((r) => r.id === item.id);
  if (existing && existing.revision !== item.revision)
    throw Error(
      "This opportunity changed in another tab. Close details and reopen it.",
    );
  const updated = validateRecords(
    [{ ...item, revision: item.revision + 1 }],
    demo[0],
  )[0];
  const next = existing
    ? records.map((r) => (r.id === item.id ? updated : r))
    : [updated, ...records];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return updated;
}
export function importRecords(storage, text, demo) {
  const imported = validateRecords(JSON.parse(text), demo[0]);
  const current = loadRecords(storage, demo);
  const merged = new Map(current.map((r) => [r.id, r]));
  for (const r of imported)
    merged.set(r.id, {
      ...r,
      revision: (merged.get(r.id)?.revision ?? r.revision) + 1,
    });
  const next = [...merged.values()];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
