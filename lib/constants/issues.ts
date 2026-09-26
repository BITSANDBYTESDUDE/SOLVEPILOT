import type { IssueCategory, IssuePriority, IssueSource, IssueStatus } from "@/types/domain";

/**
 * Problem (issue) vocabulary and rules (Task 11).
 *
 * Client-safe on purpose: the create form and the server validators read the
 * same limits and the same messages from here, so the browser can never show a
 * rule the server does not enforce. The database stores the internal enum values
 * from `types/domain`; the labels below are for display only.
 */

/* -------------------------------------------------------------------------- */
/* Field limits                                                                */
/* -------------------------------------------------------------------------- */

export const ISSUE_TITLE_MIN_LENGTH = 3;
export const ISSUE_TITLE_MAX_LENGTH = 200;
export const ISSUE_DESCRIPTION_MIN_LENGTH = 10;
export const ISSUE_DESCRIPTION_MAX_LENGTH = 10_000;

/** Applied when the user does not choose explicitly. */
export const DEFAULT_ISSUE_CATEGORY: IssueCategory = "other";
export const DEFAULT_ISSUE_PRIORITY: IssuePriority = "medium";
/** Text is the only capture mode implemented in Task 11. */
export const ISSUE_CREATION_SOURCE: IssueSource = "text";

export const ISSUE_TITLE_MESSAGES = {
  required: "Title is required.",
  tooShort: `Title must be at least ${ISSUE_TITLE_MIN_LENGTH} characters.`,
  tooLong: `Title must be ${ISSUE_TITLE_MAX_LENGTH} characters or fewer.`,
} as const;

export const ISSUE_DESCRIPTION_MESSAGES = {
  required: "Description is required.",
  tooShort: `Description must be at least ${ISSUE_DESCRIPTION_MIN_LENGTH} characters.`,
  tooLong: `Description must be ${ISSUE_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
} as const;

/* -------------------------------------------------------------------------- */
/* Selectors                                                                   */
/* -------------------------------------------------------------------------- */

export interface IssueCategoryOption {
  value: IssueCategory;
  label: string;
  hint: string;
}

export const ISSUE_CATEGORY_OPTIONS: readonly IssueCategoryOption[] = [
  { value: "technical", label: "Technical", hint: "Bugs, errors, code and infrastructure" },
  { value: "ui", label: "UI / Design", hint: "Layout, styling and usability" },
  { value: "business", label: "Business", hint: "Process, cost and strategy" },
  { value: "productivity", label: "Productivity", hint: "Workflow and time management" },
  { value: "academic", label: "Academic", hint: "Study, research and coursework" },
  { value: "other", label: "Other", hint: "Anything that does not fit above" },
];

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = Object.fromEntries(
  ISSUE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<IssueCategory, string>;

export interface IssuePriorityOption {
  value: IssuePriority;
  label: string;
  hint: string;
}

export const ISSUE_PRIORITY_OPTIONS: readonly IssuePriorityOption[] = [
  { value: "low", label: "Low", hint: "Handle when there is room" },
  { value: "medium", label: "Medium", hint: "Normal queue" },
  { value: "high", label: "High", hint: "Handle soon" },
  { value: "critical", label: "Critical", hint: "Blocking — handle now" },
];

export const ISSUE_PRIORITY_LABELS: Record<IssuePriority, string> = Object.fromEntries(
  ISSUE_PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<IssuePriority, string>;

export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "New",
  analyzing: "Analyzing",
  planned: "Planned",
  in_progress: "In progress",
  verification: "Verification",
  resolved: "Resolved",
  closed: "Closed",
};

/** Lifecycle order, so filters and legends always list statuses the same way. */
export const ISSUE_STATUS_OPTIONS: readonly { value: IssueStatus; label: string }[] = (
  Object.keys(ISSUE_STATUS_LABELS) as IssueStatus[]
).map((value) => ({ value, label: ISSUE_STATUS_LABELS[value] }));

/**
 * Priority is an ordered scale, not text.
 *
 * The database stores `low | medium | high | critical`, which sorts
 * alphabetically as critical < high < low < medium — never what a user means.
 * Every priority ordering in the product goes through these weights instead.
 */
export const ISSUE_PRIORITY_WEIGHTS: Record<IssuePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/* -------------------------------------------------------------------------- */
/* List: sorting and pagination (Task 12)                                      */
/* -------------------------------------------------------------------------- */

export const ISSUE_SORTS = [
  "created_desc",
  "created_asc",
  "updated_desc",
  "priority_desc",
  "priority_asc",
  "title_asc",
  "title_desc",
] as const;

export type IssueSort = (typeof ISSUE_SORTS)[number];

export const ISSUE_SORT_OPTIONS: readonly { value: IssueSort; label: string }[] = [
  { value: "created_desc", label: "Newest" },
  { value: "created_asc", label: "Oldest" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "priority_desc", label: "Priority: High → Low" },
  { value: "priority_asc", label: "Priority: Low → High" },
  { value: "title_asc", label: "Title: A → Z" },
  { value: "title_desc", label: "Title: Z → A" },
];

export const DEFAULT_ISSUE_SORT: IssueSort = "created_desc";
export const DEFAULT_ISSUE_PAGE = 1;
export const DEFAULT_ISSUE_PAGE_SIZE = 20;
export const MAX_ISSUE_PAGE_SIZE = 100;

/** Sentinel the project filter uses for "problems with no project". */
export const NO_PROJECT_FILTER = "none";
/** Sentinel every filter uses for "no filter applied". */
export const ALL_FILTER = "all";

export const ISSUE_SOURCE_LABELS: Record<IssueSource, string> = {
  text: "Text",
  image: "Image",
  pdf: "PDF",
  voice: "Voice",
  mixed: "Mixed",
};

export function issueCategoryLabel(value: IssueCategory): string {
  return ISSUE_CATEGORY_LABELS[value] ?? "Other";
}

export function issuePriorityLabel(value: IssuePriority): string {
  return ISSUE_PRIORITY_LABELS[value] ?? "Medium";
}

export function issueStatusLabel(value: IssueStatus): string {
  return ISSUE_STATUS_LABELS[value] ?? value;
}

export function issueSourceLabel(value: IssueSource): string {
  return ISSUE_SOURCE_LABELS[value] ?? "Text";
}

/* -------------------------------------------------------------------------- */
/* Draft validation (same rules as `validators/issue.ts`)                      */
/* -------------------------------------------------------------------------- */

export interface IssueDraft {
  title: string;
  description: string;
}

export type IssueDraftErrors = Partial<Record<keyof IssueDraft, string>>;

/**
 * Check a draft before it is sent, so the user sees the reason immediately.
 *
 * The server re-validates everything — this only shortens the feedback loop.
 */
export function issueDraftErrors(draft: IssueDraft): IssueDraftErrors {
  const errors: IssueDraftErrors = {};

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.title = ISSUE_TITLE_MESSAGES.required;
  } else if (title.length < ISSUE_TITLE_MIN_LENGTH) {
    errors.title = ISSUE_TITLE_MESSAGES.tooShort;
  } else if (title.length > ISSUE_TITLE_MAX_LENGTH) {
    errors.title = ISSUE_TITLE_MESSAGES.tooLong;
  }

  const description = draft.description.trim();
  if (description.length === 0) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.required;
  } else if (description.length < ISSUE_DESCRIPTION_MIN_LENGTH) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.tooShort;
  } else if (description.length > ISSUE_DESCRIPTION_MAX_LENGTH) {
    errors.description = ISSUE_DESCRIPTION_MESSAGES.tooLong;
  }

  return errors;
}

export function isIssueDraftValid(draft: IssueDraft): boolean {
  return Object.keys(issueDraftErrors(draft)).length === 0;
}

/* -------------------------------------------------------------------------- */
/* List view state ↔ URL query string (Task 12)                                */
/* -------------------------------------------------------------------------- */

/**
 * The list's visible state.
 *
 * Mirrored into the URL (minus defaults) so a filtered page survives a refresh,
 * can be shared, and works with back/forward. Nothing sensitive goes in there —
 * only the user's own filter choices.
 */
export interface IssueListViewState {
  search: string;
  status: IssueStatus | typeof ALL_FILTER;
  priority: IssuePriority | typeof ALL_FILTER;
  category: IssueCategory | typeof ALL_FILTER;
  /** `"all"`, `"none"` (no project) or a project ObjectId. */
  projectId: string;
  sort: IssueSort;
  page: number;
}

export const EMPTY_ISSUE_LIST_STATE: IssueListViewState = {
  search: "",
  status: ALL_FILTER,
  priority: ALL_FILTER,
  category: ALL_FILTER,
  projectId: ALL_FILTER,
  sort: DEFAULT_ISSUE_SORT,
  page: DEFAULT_ISSUE_PAGE,
};

const STATUS_VALUES = Object.keys(ISSUE_STATUS_LABELS) as IssueStatus[];
const PRIORITY_VALUES = ISSUE_PRIORITY_OPTIONS.map((option) => option.value);

type QueryLike = URLSearchParams | Record<string, string | string[] | undefined>;

function readParam(params: QueryLike, key: string): string {
  const value = params instanceof URLSearchParams ? params.get(key) : (params[key] ?? undefined);
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim() : "";
}

function oneOf<TValue extends string>(value: string, allowed: readonly TValue[]): TValue | null {
  return (allowed as readonly string[]).includes(value) ? (value as TValue) : null;
}

/**
 * Read the list state from a query string or a params object.
 *
 * Unknown or invalid values fall back to the default rather than throwing: a
 * shared link with a typo should still show a usable list. The API remains
 * strict — it rejects invalid parameters with a 400.
 */
export function issueListStateFromParams(params: QueryLike): IssueListViewState {
  const search = readParam(params, "search").slice(0, 200);
  const sort = oneOf(readParam(params, "sort"), ISSUE_SORTS) ?? DEFAULT_ISSUE_SORT;

  const rawPage = Number.parseInt(readParam(params, "page"), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_ISSUE_PAGE;

  const projectId = readParam(params, "projectId");

  return {
    search,
    status: oneOf(readParam(params, "status"), STATUS_VALUES) ?? ALL_FILTER,
    priority: oneOf(readParam(params, "priority"), PRIORITY_VALUES) ?? ALL_FILTER,
    category:
      oneOf(
        readParam(params, "category"),
        ISSUE_CATEGORY_OPTIONS.map((o) => o.value),
      ) ?? ALL_FILTER,
    projectId: projectId === NO_PROJECT_FILTER || projectId.length > 0 ? projectId : ALL_FILTER,
    sort,
    page,
  };
}

/** Serialize the state, leaving out anything that matches the default. */
export function issueListStateToSearchParams(state: IssueListViewState): URLSearchParams {
  const params = new URLSearchParams();

  if (state.search.trim()) params.set("search", state.search.trim());
  if (state.status !== ALL_FILTER) params.set("status", state.status);
  if (state.priority !== ALL_FILTER) params.set("priority", state.priority);
  if (state.category !== ALL_FILTER) params.set("category", state.category);
  if (state.projectId !== ALL_FILTER) params.set("projectId", state.projectId);
  if (state.sort !== DEFAULT_ISSUE_SORT) params.set("sort", state.sort);
  if (state.page > DEFAULT_ISSUE_PAGE) params.set("page", String(state.page));

  return params;
}

export function issueListQueryString(state: IssueListViewState): string {
  const params = issueListStateToSearchParams(state);
  const query = params.toString();
  return query.length > 0 ? `/dashboard/issues?${query}` : "/dashboard/issues";
}

/** How many of search / status / priority / category / project are narrowed. */
export function countActiveIssueFilters(state: IssueListViewState): number {
  let count = 0;
  if (state.search.trim().length > 0) count += 1;
  if (state.status !== ALL_FILTER) count += 1;
  if (state.priority !== ALL_FILTER) count += 1;
  if (state.category !== ALL_FILTER) count += 1;
  if (state.projectId !== ALL_FILTER) count += 1;
  return count;
}

export function hasActiveIssueFilters(state: IssueListViewState): boolean {
  return countActiveIssueFilters(state) > 0;
}

/**
 * Map a normalized list query back onto the UI state.
 *
 * The service answers with the query it actually applied (defaults filled in), so
 * the controls and the URL always describe the results on screen.
 */
export function issueListViewFromQuery(query: {
  search?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  category?: IssueCategory;
  projectId?: string;
  sort: IssueSort;
  page: number;
}): IssueListViewState {
  return {
    search: query.search ?? "",
    status: query.status ?? ALL_FILTER,
    priority: query.priority ?? ALL_FILTER,
    category: query.category ?? ALL_FILTER,
    projectId: query.projectId ?? ALL_FILTER,
    sort: query.sort,
    page: query.page,
  };
}
