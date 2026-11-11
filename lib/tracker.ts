export function deadlineCompare(
  a: { deadline?: string },
  b: { deadline?: string },
) {
  return (a.deadline || "9999").localeCompare(b.deadline || "9999");
}
export function nextUpDeadline(record: {
  stage: string;
  assessmentDeadline?: string;
  followup: string;
}) {
  if (record.stage.endsWith("pending"))
    return {
      label: record.stage.startsWith("HireVue")
        ? "HireVue deadline"
        : "Assessment deadline",
      date: record.assessmentDeadline || "",
    };
  return { label: "Follow-up deadline", date: record.followup || "" };
}
