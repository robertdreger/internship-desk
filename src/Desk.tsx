import { useEffect, useMemo, useRef, useState } from "react";
import demo from "./demo.json";
import {
  loadRecords,
  saveRecord,
  importRecords,
  STORAGE_KEY,
} from "../lib/storage.mjs";
import { season } from "../tracker.config";
import { deadlineCompare, nextUpDeadline } from "../lib/tracker";
import {
  ArrowUpRight,
  ArrowRight,
  Search,
  Plus,
  Layers3,
  Sun,
  Flower2,
  BriefcaseBusiness,
  Star,
  Archive,
  Download,
  X,
  Check,
  ChevronDown,
  Clock3,
  CalendarDays,
  Menu,
  RotateCcw,
  LoaderCircle,
  ShieldCheck,
  AlertCircle,
  Trash2,
} from "lucide-react";
type RecordItem = {
  id: string;
  type: string;
  company: string;
  title: string;
  category: string;
  focus: string;
  location: string;
  region: string;
  timing: string;
  evidence: string;
  deadline: string;
  assessmentDeadline: string;
  deadlineBasis: string;
  cv: string;
  status: string;
  stage: string;
  appliedAt: string;
  followup: string;
  interviewDate: string;
  offerDeadline: string;
  contact: string;
  notes: string;
  nextAction: string;
  checkedAt: string;
  source: string;
  personalNotes: string;
  priority: boolean;
  archived: boolean;
  revision: number;
};
const statuses = [
  "Not started",
  "Not open yet",
  "Preparing",
  "Applied",
  "Assessment",
  "Interviewing",
  "Offer",
  "Accepted",
  "Rejected",
  "Withdrawn",
  "On hold",
];
const stages = [
  "None",
  "Online test pending",
  "Online test completed",
  "CodeVue pending",
  "CodeVue completed",
  "HireVue pending",
  "HireVue completed",
  "Video interview",
  "Recruiter screen",
  "Technical interview",
  "Case interview",
  "Assessment centre",
  "Final round",
  "Completed",
];
const terminal = ["Rejected", "Withdrawn", "Accepted"];
const inPipeline = (r: RecordItem) =>
  !["Not started", "Not open yet", "Preparing", "On hold"].includes(r.status);
const dateText = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not stated";
function due(v: string) {
  if (!v) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return Math.round(
    (new Date(v + "T00:00:00").getTime() - d.getTime()) / 86400000,
  );
}
function statusClass(s: string) {
  return s === "Assessment"
    ? "purple"
    : s === "Applied"
      ? "blue"
      : ["Offer", "Accepted"].includes(s)
        ? "green"
        : s === "Rejected"
          ? "red"
          : "";
}
const navItems = [
  { id: "pipeline", label: "My applications", icon: BriefcaseBusiness },
  { id: "summer", label: "Summer internships", icon: Sun },
  { id: "spring", label: "Spring insights", icon: Flower2 },
  { id: "saved", label: "Shortlist", icon: Star },
  { id: "archive", label: "Archived", icon: Archive },
];
export default function Desk() {
  const [records, setRecords] = useState<RecordItem[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [view, setView] = useState("pipeline"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [status, setStatus] = useState("All statuses"),
    [region, setRegion] = useState("All locations"),
    [sort, setSort] = useState("Action first"),
    [selected, setSelected] = useState<RecordItem | null>(null),
    [saving, setSaving] = useState(false),
    [menu, setMenu] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setRecords(loadRecords(localStorage, demo) as RecordItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tracker.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) load();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!selected) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) setSelected(null);
    };
    document.addEventListener("keydown", handler);
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prior;
    };
  }, [selected, saving]);
  const save = async (item: RecordItem, close = false) => {
    setSaving(true);
    setError("");
    try {
      const data = {
        record: saveRecord(localStorage, item, demo) as RecordItem,
      };
      setRecords((old) =>
        old.some((r) => r.id === item.id)
          ? old.map((r) => (r.id === item.id ? data.record : r))
          : [data.record, ...old],
      );
      if (close) setSelected(null);
      else if (selected?.id === item.id) setSelected(data.record);
      setNotice(
        item.archived
          ? "Removed from tracker. Restore it in Archived."
          : "Changes saved",
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const restoreBackup = async (file: File) => {
    try {
      if (file.size > 2000000) throw Error("Backup must be smaller than 2 MB.");
      const restored = importRecords(localStorage, await file.text(), demo);
      setRecords(restored as RecordItem[]);
      setNotice("Backup imported into this browser");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import backup.");
    } finally {
      if (importInput.current) importInput.current.value = "";
    }
  };
  const active = records.filter((r) => !r.archived),
    pipeline = active.filter(inPipeline);
  const actionItems = active
    .filter(
      (r) =>
        !terminal.includes(r.status) &&
        (r.stage.endsWith("pending") || (r.followup && due(r.followup)! <= 0)),
    )
    .sort((a, b) =>
      deadlineCompare(
        { deadline: nextUpDeadline(a).date },
        { deadline: nextUpDeadline(b).date },
      ),
    );
  const count = (id: string) =>
    id === "pipeline"
      ? pipeline.length
      : id === "saved"
        ? active.filter((r) => r.priority).length
        : id === "archive"
          ? records.filter((r) => r.archived).length
          : active.filter((r) => r.type === id).length;
  const list = useMemo(() => {
    let a = records.filter((r) =>
      view === "archive"
        ? r.archived
        : !r.archived &&
          (view === "pipeline"
            ? inPipeline(r)
            : view === "saved"
              ? r.priority
              : r.type === view),
    );
    if (query)
      a = a.filter((r) =>
        [r.company, r.title, r.focus, r.location, r.notes, r.personalNotes]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      );
    if (category !== "All categories")
      a = a.filter((r) => r.category === category);
    if (status !== "All statuses") a = a.filter((r) => r.status === status);
    if (region !== "All locations") a = a.filter((r) => r.region === region);
    return [...a].sort((a, b) =>
      sort === "Company A–Z"
        ? a.company.localeCompare(b.company)
        : sort === "Application deadline"
          ? deadlineCompare(a, b)
          : sort === "Assessment deadline"
            ? deadlineCompare(
                { deadline: a.assessmentDeadline },
                { deadline: b.assessmentDeadline },
              )
            : Number(b.stage.endsWith("pending")) -
                Number(a.stage.endsWith("pending")) ||
              Number(b.priority) - Number(a.priority) ||
              Number(inPipeline(b)) - Number(inPipeline(a)) ||
              a.company.localeCompare(b.company),
    );
  }, [records, view, query, category, status, region, sort]);
  const navigate = (v: string) => {
    setView(v);
    setQuery("");
    setCategory("All categories");
    setStatus("All statuses");
    setRegion("All locations");
    setMenu(false);
  };
  const newItem = () =>
    setSelected({
      id: crypto.randomUUID(),
      type: view === "spring" ? "spring" : "summer",
      company: "",
      title: "",
      category: "Data/ML",
      focus: "",
      location: "",
      region: "UK",
      timing: "Summer " + season,
      evidence: "User-added — not verified",
      deadline: "",
      assessmentDeadline: "",
      deadlineBasis: "Unknown — no verified closing date",
      cv: "Quant & Data",
      status: "Not started",
      stage: "None",
      appliedAt: "",
      followup: "",
      interviewDate: "",
      offerDeadline: "",
      contact: "",
      notes: "",
      nextAction: "",
      checkedAt: "",
      source: "",
      personalNotes: "",
      priority: false,
      archived: false,
      revision: 0,
    });
  function download(kind: string) {
    const keys = [
      "id",
      "type",
      "company",
      "title",
      "category",
      "location",
      "status",
      "stage",
      "deadline",
      "assessmentDeadline",
      "appliedAt",
      "followup",
      "nextAction",
      "cv",
      "source",
      "personalNotes",
    ];
    const content =
      kind === "json"
        ? JSON.stringify(records, null, 2)
        : "\uFEFF" +
          [
            keys,
            ...records.map((r) =>
              keys.map((k) => String(r[k as keyof RecordItem] ?? "")),
            ),
          ]
            .map((row) =>
              row
                .map((c) => '"' + String(c).replaceAll('"', '""') + '"')
                .join(","),
            )
            .join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([content], {
        type: kind === "json" ? "application/json" : "text/csv;charset=utf-8",
      }),
    );
    a.download = "internship-desk-" + season + "." + kind;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const title =
    view === "pipeline"
      ? "Your applications"
      : view === "summer"
        ? "Summer internships"
        : view === "spring"
          ? "Spring insights"
          : view === "saved"
            ? "Your shortlist"
            : "Archived opportunities";
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <a className="brand" href="./" aria-label="Internship Desk home">
          <span className="brand-icon">
            <Layers3 size={21} />
          </span>
          <span>
            Internship<span className="brand-light">Desk</span>
          </span>
        </a>
        <div className="workspace-label">
          YOUR WORKSPACE <span>{season}</span>
        </div>
        <nav aria-label="Tracker views">
          {navItems.map((n) => (
            <button
              key={n.id}
              className={"nav-item " + (view === n.id ? "active" : "")}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              <small>{count(n.id)}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <ShieldCheck size={16} />
          <div>
            Browser workspace<small>Saved on this device</small>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="mobile-shade"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMenu(!menu)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>Summer {season}</strong>
          </div>
          <div className="top-right">
            <span className="private-label">
              <span className="green-dot" />
              Local storage
            </span>
            <span className="avatar">ID</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">THE NEXT CHAPTER</div>
              <h1>
                {title}
                <span className="title-dot">.</span>
              </h1>
              <p>
                {view === "pipeline"
                  ? "Every application, assessment and next step in one place."
                  : view === "spring"
                    ? "Short programmes. New perspectives. A way into quant and technology."
                    : view === "archive"
                      ? "Set aside for now. Restore an opportunity whenever you need it."
                      : "Explore your options, keep the best fits, and track what happens next."}
              </p>
            </div>
            <button className="primary" onClick={newItem} disabled={loading}>
              <Plus size={17} /> Add opportunity
            </button>
          </div>
          <div className="stats">
            <button onClick={() => navigate("pipeline")}>
              <span>
                Applications sent
                <ArrowUpRight size={15} />
              </span>
              <strong>{pipeline.length.toString().padStart(2, "0")}</strong>
              <small>Across summer & spring</small>
            </button>
            <button
              onClick={() => {
                navigate("pipeline");
                setStatus("Assessment");
              }}
            >
              <span>
                In assessment
                <Clock3 size={15} />
              </span>
              <strong>
                {active
                  .filter((r) => r.status === "Assessment")
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <small>Keep the momentum</small>
            </button>
            <button onClick={() => navigate("spring")}>
              <span>
                Spring opportunities
                <Flower2 size={15} />
              </span>
              <strong>
                {active
                  .filter((r) => r.type === "spring")
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <small>Summer & spring insights</small>
            </button>
            <button onClick={() => navigate("saved")}>
              <span>
                Shortlisted
                <Star size={15} />
              </span>
              <strong>
                {active
                  .filter((r) => r.priority)
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <small>Your favourites, together</small>
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button onClick={() => load()}>Reload saved data</button>
            </div>
          )}
          {view === "pipeline" && actionItems.length > 0 && (
            <section className="action-section">
              <div className="section-line">
                <h2>
                  Next up <span>{actionItems.length}</span>
                </h2>
                <span>A little focus goes a long way</span>
              </div>
              <div className="action-grid">
                {actionItems.slice(0, 3).map((r) => (
                  <button
                    key={r.id}
                    className="action-card"
                    onClick={() => setSelected({ ...r })}
                  >
                    <span className="action-icon">
                      <Clock3 size={20} />
                    </span>
                    <div>
                      <span className="tiny-label">
                        {r.company} · {r.location}
                      </span>
                      <h3>
                        {r.stage.endsWith("pending")
                          ? r.stage
                          : r.nextAction || "Follow-up due"}
                      </h3>
                      <p>{r.nextAction || "Review your next step"}</p>
                      <small
                        className={
                          nextUpDeadline(r).date &&
                          due(nextUpDeadline(r).date)! < 0
                            ? "overdue"
                            : ""
                        }
                      >
                        {nextUpDeadline(r).date
                          ? nextUpDeadline(r).label +
                            " " +
                            dateText(nextUpDeadline(r).date)
                          : "No " +
                            (r.stage.endsWith("pending")
                              ? "assessment"
                              : "follow-up") +
                            " deadline set"}
                      </small>
                    </div>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="records-section">
            <div className="section-line">
              <h2>
                {view === "pipeline"
                  ? "Application pipeline"
                  : view === "spring"
                    ? "Insight programmes"
                    : "Opportunities"}{" "}
                <span>{list.length}</span>
              </h2>
              <div className="exports">
                <input
                  ref={importInput}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  aria-label="Import JSON backup"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreBackup(file);
                  }}
                />
                <button onClick={() => importInput.current?.click()}>
                  Import backup
                </button>
                <button onClick={() => download("csv")} disabled={loading}>
                  <Download size={14} /> CSV
                </button>
                <button onClick={() => download("json")} disabled={loading}>
                  Backup
                </button>
              </div>
            </div>
            <div className="filters">
              <label className="search">
                <Search size={17} />
                <input
                  aria-label="Search opportunities"
                  placeholder="Search company, role or location…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="icon-btn"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <select
                aria-label="Filter category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>All categories</option>
                {[...new Set(active.map((r) => r.category))].sort().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>All statuses</option>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Filter location"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option>All locations</option>
                {[...new Set(active.map((r) => r.region))].sort().map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <label className="sort">
                <span>Sort:</span>
                <select
                  aria-label="Sort opportunities"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option>Action first</option>
                  <option>Company A–Z</option>
                  <option>Application deadline</option>
                  <option>Assessment deadline</option>
                </select>
              </label>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th aria-label="Shortlist" />
                    <th>Company & opportunity</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Next step</th>
                    <th>
                      <button
                        className="deadline-sort"
                        onClick={() =>
                          setSort(
                            view === "pipeline"
                              ? "Assessment deadline"
                              : "Application deadline",
                          )
                        }
                      >
                        {view === "pipeline"
                          ? "Assessment deadline"
                          : "Application deadline"}{" "}
                        <ChevronDown size={11} />
                      </button>
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button
                          className={
                            "star-btn " + (r.priority ? "starred" : "")
                          }
                          onClick={() => save({ ...r, priority: !r.priority })}
                          disabled={saving}
                          aria-label={
                            (r.priority ? "Remove from" : "Add to") +
                            " shortlist: " +
                            r.company
                          }
                        >
                          <Star
                            size={17}
                            fill={r.priority ? "currentColor" : "none"}
                          />
                        </button>
                      </td>
                      <td>
                        <button
                          className="record-title"
                          onClick={() => setSelected({ ...r })}
                        >
                          <span className="company-line">
                            <span
                              className={
                                "company-mark " +
                                (r.type === "spring" ? "spring-mark" : "")
                              }
                            >
                              {r.company
                                .replace("D. E.", "DE")
                                .split(" ")
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <strong>{r.company}</strong>
                            <span className="type-tag">
                              {r.type === "spring" ? "Insight" : r.category}
                            </span>
                          </span>
                          <span className="role-title">{r.title}</span>
                          {r.focus && (
                            <span className="role-focus">{r.focus}</span>
                          )}
                        </button>
                      </td>
                      <td>
                        <span className="location-text">{r.location}</span>
                        <small className="muted-block">
                          {r.type === "spring" ? r.timing : r.region}
                        </small>
                      </td>
                      <td>
                        <select
                          aria-label={
                            "Application status for " + r.company + " " + r.id
                          }
                          className={"status-select " + statusClass(r.status)}
                          value={r.status}
                          onChange={(e) =>
                            save({ ...r, status: e.target.value })
                          }
                          disabled={saving}
                        >
                          {statuses.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                        {r.stage !== "None" && (
                          <small className="muted-block">{r.stage}</small>
                        )}
                      </td>
                      <td>
                        <button
                          className="next-step"
                          onClick={() => setSelected({ ...r })}
                        >
                          {r.nextAction || "Add a next step"}
                          {r.stage.endsWith("pending") && (
                            <span className="attention-dot" />
                          )}
                        </button>
                        {r.followup && (
                          <small className="muted-block">
                            Follow up {dateText(r.followup)}
                          </small>
                        )}
                      </td>
                      <td>
                        <DeadlineCell
                          date={
                            view === "pipeline"
                              ? r.assessmentDeadline
                              : r.deadline
                          }
                          assessment={view === "pipeline"}
                        />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-btn row-open"
                            onClick={() => setSelected({ ...r })}
                            aria-label={"Open " + r.company + " details"}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                          <button
                            className="icon-btn remove-btn"
                            title={
                              r.archived
                                ? "Restore opportunity"
                                : "Remove opportunity"
                            }
                            aria-label={
                              (r.archived ? "Restore " : "Remove ") +
                              r.company +
                              " " +
                              r.id
                            }
                            disabled={saving}
                            onClick={() =>
                              save({ ...r, archived: !r.archived })
                            }
                          >
                            {r.archived ? (
                              <RotateCcw size={15} />
                            ) : (
                              <Trash2 size={15} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {loading ? (
                <div className="empty">
                  <LoaderCircle className="spin" size={23} />
                  <h3>Opening your desk…</h3>
                </div>
              ) : list.length === 0 ? (
                <div className="empty">
                  <Search size={24} />
                  <h3>
                    {view === "saved"
                      ? "Make room for your favourites"
                      : "Nothing here yet"}
                  </h3>
                  <p>
                    {view === "saved"
                      ? "Star an opportunity to keep it on your shortlist."
                      : "Try different filters or add an opportunity."}
                  </p>
                  <button onClick={() => navigate(view)}>Clear filters</button>
                </div>
              ) : null}
            </div>
            <div className="table-footer">
              <span>
                {list.length}{" "}
                {list.length === 1 ? "opportunity" : "opportunities"} shown
              </span>
              <span>
                <span className="green-dot" /> Changes save in this browser
              </span>
            </div>
          </section>
          <footer className="page-footer">
            <span>
              Demo companies and dates are fictional. Add and verify your own
              opportunities.
            </span>
            <span>Local storage · export a backup regularly</span>
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {selected && (
        <div
          className="drawer-overlay"
          onClick={() => !saving && setSelected(null)}
        >
          <section
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer-top">
              <span className="eyebrow">OPPORTUNITY DETAILS</span>
              <button
                className="icon-btn"
                onClick={() => setSelected(null)}
                disabled={saving}
                aria-label="Close details"
              >
                <X size={21} />
              </button>
            </header>
            <div className="drawer-body">
              <span className="type-tag">
                {selected.type === "spring"
                  ? "Spring insight"
                  : "Summer internship"}
              </span>
              <h2 id="detail-title">{selected.company || "New opportunity"}</h2>
              <p className="drawer-sub">
                {selected.title || "Add the company and role to get started."}
              </p>
              <div className="evidence-box">
                <ShieldCheck size={17} />
                <div>
                  <strong>{selected.evidence}</strong>
                  <span>
                    {selected.checkedAt
                      ? "Source checked " + dateText(selected.checkedAt)
                      : "Not independently checked"}{" "}
                    · {selected.deadlineBasis}
                  </span>
                </div>
              </div>
              <form
                id="record-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const dates = Object.fromEntries(
                    [
                      "appliedAt",
                      "followup",
                      "assessmentDeadline",
                      "interviewDate",
                      "offerDeadline",
                      "deadline",
                      "checkedAt",
                    ].map((key) => [key, String(form.get(key) ?? "")]),
                  );
                  save({ ...selected, ...dates }, true);
                }}
              >
                <h3 className="form-heading">Application progress</h3>
                <div className="form-grid">
                  <Field label="Application status">
                    <select
                      value={selected.status}
                      onChange={(e) =>
                        setSelected({ ...selected, status: e.target.value })
                      }
                    >
                      {statuses.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Assessment / interview stage">
                    <select
                      value={selected.stage}
                      onChange={(e) =>
                        setSelected({ ...selected, stage: e.target.value })
                      }
                    >
                      {[...new Set([...stages, selected.stage])].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date applied">
                    <input
                      type="date"
                      name="appliedAt"
                      value={selected.appliedAt}
                      onChange={(e) =>
                        setSelected({ ...selected, appliedAt: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Follow-up date">
                    <input
                      type="date"
                      name="followup"
                      value={selected.followup}
                      onChange={(e) =>
                        setSelected({ ...selected, followup: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="HireVue / assessment deadline">
                    <input
                      type="date"
                      name="assessmentDeadline"
                      value={selected.assessmentDeadline || ""}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          assessmentDeadline: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Interview / assessment date">
                    <input
                      type="date"
                      name="interviewDate"
                      value={selected.interviewDate}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          interviewDate: e.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Offer response deadline">
                    <input
                      type="date"
                      name="offerDeadline"
                      value={selected.offerDeadline}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          offerDeadline: e.target.value,
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label="Next action">
                  <input
                    value={selected.nextAction}
                    placeholder="What’s the next small step?"
                    onChange={(e) =>
                      setSelected({ ...selected, nextAction: e.target.value })
                    }
                  />
                </Field>
                <Field label="Personal notes / CV filename">
                  <textarea
                    rows={4}
                    value={selected.personalNotes}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        personalNotes: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Contact / referral">
                  <input
                    value={selected.contact}
                    onChange={(e) =>
                      setSelected({ ...selected, contact: e.target.value })
                    }
                  />
                </Field>
                <h3 className="form-heading">Role & fit</h3>
                <div className="form-grid">
                  <Field label="Company">
                    <input
                      required
                      value={selected.company}
                      onChange={(e) =>
                        setSelected({ ...selected, company: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Opportunity type">
                    <select
                      value={selected.type}
                      onChange={(e) =>
                        setSelected({ ...selected, type: e.target.value })
                      }
                    >
                      <option value="summer">Summer internship</option>
                      <option value="spring">Spring insight</option>
                    </select>
                  </Field>
                </div>
                <Field label="Exact role / programme title">
                  <input
                    required
                    value={selected.title}
                    onChange={(e) =>
                      setSelected({ ...selected, title: e.target.value })
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Category">
                    <input
                      value={selected.category}
                      list="categories"
                      onChange={(e) =>
                        setSelected({ ...selected, category: e.target.value })
                      }
                    />
                    <datalist id="categories">
                      {[...new Set(records.map((r) => r.category))].map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="CV version">
                    <select
                      value={selected.cv}
                      onChange={(e) =>
                        setSelected({ ...selected, cv: e.target.value })
                      }
                    >
                      {[
                        "Finance & Risk",
                        "Quant & Data",
                        "Consulting & Strategy",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Office / location">
                    <input
                      value={selected.location}
                      onChange={(e) =>
                        setSelected({ ...selected, location: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Region">
                    <input
                      value={selected.region}
                      onChange={(e) =>
                        setSelected({ ...selected, region: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Function / focus">
                  <input
                    value={selected.focus}
                    onChange={(e) =>
                      setSelected({ ...selected, focus: e.target.value })
                    }
                  />
                </Field>
                <Field label="Programme dates / duration">
                  <input
                    value={selected.timing}
                    onChange={(e) =>
                      setSelected({ ...selected, timing: e.target.value })
                    }
                  />
                </Field>
                <Field label="Eligibility & research notes">
                  <textarea
                    rows={4}
                    value={selected.notes}
                    onChange={(e) =>
                      setSelected({ ...selected, notes: e.target.value })
                    }
                  />
                </Field>
                <h3 className="form-heading">Source & deadline</h3>
                <div className="form-grid">
                  <Field label="Application deadline (leave unknown blank)">
                    <input
                      type="date"
                      name="deadline"
                      value={selected.deadline}
                      onChange={(e) =>
                        setSelected({ ...selected, deadline: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Source last checked">
                    <input
                      type="date"
                      name="checkedAt"
                      value={selected.checkedAt}
                      onChange={(e) =>
                        setSelected({ ...selected, checkedAt: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Field label="Deadline basis / invitation details">
                  <input
                    value={selected.deadlineBasis}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        deadlineBasis: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Opening evidence">
                  <input
                    value={selected.evidence}
                    onChange={(e) =>
                      setSelected({ ...selected, evidence: e.target.value })
                    }
                  />
                </Field>
                <Field label="Official source URL">
                  <input
                    type="url"
                    value={selected.source}
                    onChange={(e) =>
                      setSelected({ ...selected, source: e.target.value })
                    }
                  />
                </Field>
                {/^https?:\/\//.test(selected.source) && (
                  <a
                    className="source-link"
                    href={selected.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open official source <ArrowUpRight size={15} />
                  </a>
                )}
              </form>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="drawer-footer">
              <button
                className="secondary"
                onClick={() =>
                  save({ ...selected, archived: !selected.archived }, true)
                }
                disabled={saving || !selected.company}
              >
                {selected.archived ? (
                  <RotateCcw size={15} />
                ) : (
                  <Archive size={15} />
                )}{" "}
                {selected.archived ? "Restore" : "Remove from tracker"}
              </button>
              <button
                className="primary"
                form="record-form"
                type="submit"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Check size={16} />
                )}{" "}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DeadlineCell({
  date,
  assessment,
}: {
  date: string;
  assessment: boolean;
}) {
  const days = due(date);
  return (
    <>
      <span className={date && days! < 0 ? "past-date" : ""}>
        {date ? dateText(date) : "Not set"}
      </span>
      <small className="muted-block">
        {date
          ? days! < 0
            ? "Deadline passed"
            : days === 0
              ? "Due today"
              : days + " days away"
          : assessment
            ? "Add in opportunity details"
            : "No verified date"}
      </small>
    </>
  );
}
