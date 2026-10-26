// ============================================================
// EventWise AI — Core Domain Types
// All business logic depends on these interfaces.
// ============================================================

export type EventType = 'wedding' | 'birthday' | 'community';
export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD';
export type Preference = 'indoor' | 'outdoor' | 'flexible';
export type TaskStatus = 'pending' | 'in_progress' | 'complete' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type VendorStatus = 'researching' | 'contacted' | 'quoted' | 'booked' | 'cancelled';

// ----------------------------------------------------------------
// Event
// ----------------------------------------------------------------
export interface EventDetails {
  id: string;
  name: string;
  type: EventType;
  date: string; // ISO date string YYYY-MM-DD
  city: string;
  guestCount: number;
  budget: number;
  currency: Currency;
  preference: Preference;
  theme: string;
  dietaryRequirements: string;
  accessibilityNeeds: string;
  priorities: string[];
  notes: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// ----------------------------------------------------------------
// Budget
// ----------------------------------------------------------------
export interface BudgetCategory {
  id: string;
  name: string;
  plannedAmount: number; // user-editable allocation
  actualAmount: number;  // sum of committed expenses
  description: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  label: string;
  amount: number;
  isQuoted: boolean; // true = vendor-quoted, false = estimate
  notes: string;
  createdAt: string;
}

export interface BudgetPlan {
  categories: BudgetCategory[];
  expenses: Expense[];
  contingencyPercent: number; // e.g. 10 means 10%
  contingencyAmount: number;  // derived from total planned * percent
}

export interface BudgetSummary {
  totalBudget: number;
  totalPlanned: number;
  totalActual: number;
  contingencyAmount: number;
  /** Planned categories plus the contingency reserve. */
  plannedPlusContingency: number;
  /** Budget minus actual spending. */
  remainingBudget: number;
  /** Budget minus actual spending and the reserve that should stay untouched. */
  remainingAfterContingency: number;
  /** Actual spend per guest (0 when guest count is unknown). */
  costPerGuest: number;
  /** Planned allocation per guest (0 when guest count is unknown). */
  plannedCostPerGuest: number;
  isOverBudget: boolean;
  isOverContingency: boolean; // planned + contingency > budget
  currency: Currency;
}

// ----------------------------------------------------------------
// Timeline / Tasks
// ----------------------------------------------------------------
export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO date
  priority: TaskPriority;
  status: TaskStatus;
  category: string;
  dependsOn: string[]; // task IDs
  isGenerated: boolean; // true = auto-generated, false = user-added
  isUserEdited?: boolean; // true = user edited a generated task; preserve on replan
  completedAt?: string;
}

// ----------------------------------------------------------------
// Vendors
// ----------------------------------------------------------------
export interface Vendor {
  id: string;
  name: string;
  category: string;
  estimatedCost: number;
  quotedCost?: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: VendorStatus;
  notes: string;
  cancellationTerms: string;
  accessibilityInfo: string;
  reviewNotes?: string; // user-entered review, never a fabricated rating
  isSampleData: boolean; // always label demo rows clearly
  createdAt: string;
}

// ----------------------------------------------------------------
// Recommendations
// ----------------------------------------------------------------
export interface Recommendation {
  id: string;
  category: 'theme' | 'menu' | 'activity' | 'decoration' | 'entertainment' | 'logistics';
  title: string;
  description: string;
  reasoning: string;          // why it fits this event
  budgetImpact: 'saves' | 'neutral' | 'adds';
  estimatedCost?: number;
  isLowCostAlternative: boolean;
  dietaryNote?: string;
  accessibilityNote?: string;
  tags: string[];
  source: 'deterministic' | 'ai';
}

// ----------------------------------------------------------------
// Event Readiness
// ----------------------------------------------------------------
export interface ReadinessSummary {
  completionPercent: number;
  criticalIncomplete: Task[];
  blockedTasks: Task[];
  overdueTasks: Task[];
  upcomingDeadlines: Task[];  // due in next 14 days
  budgetRisk: 'ok' | 'warning' | 'critical';
  budgetRiskDetail: string;
  nextActions: string[];
  isReady: boolean; // only true when zero critical tasks remain
}

// ----------------------------------------------------------------
// Persisted App State (v1 schema)
// ----------------------------------------------------------------
export interface AppState {
  schemaVersion: number;
  event: EventDetails | null;
  budget: BudgetPlan | null;
  tasks: Task[];
  vendors: Vendor[];
  recommendations: Recommendation[];
  lastReplan: ReplanDiff | null;
  lastSaved: string; // ISO timestamp
}

// ----------------------------------------------------------------
// Replanning diff
// ----------------------------------------------------------------
export interface ReplanDiff {
  changedFields: string[];
  affectedTaskIds: string[];
  affectedCategoryIds: string[];
  budgetChanged: boolean;
  explanations: string[];
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------
export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
