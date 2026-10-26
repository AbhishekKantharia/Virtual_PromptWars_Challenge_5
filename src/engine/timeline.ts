// ============================================================
// EventWise AI — Timeline Generation Engine
// Generates calendar-accurate task lists based on event type,
// date, and complexity. Pure functions, deterministic.
// ============================================================

import { EventType, Task, TaskPriority, TaskStatus } from '../types';
import {
  addDays,
  subDays,
  parseISO,
  format,
  differenceInDays,
  isValid,
  isBefore,
  startOfDay,
} from 'date-fns';
import { nanoid } from '../utils/nanoid';

interface TaskTemplate {
  title: string;
  description: string;
  daysBeforeEvent: number; // negative = after the event; 0 = event day
  priority: TaskPriority;
  category: string;
  dependsOnTitles?: string[]; // resolved to IDs after generation
  minDaysNotice?: number; // skip if event is fewer than X days away
}

// ----------------------------------------------------------------
// Shared templates (all event types)
// ----------------------------------------------------------------
const SHARED_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Confirm venue booking',
    description: 'Verify venue reservation, get written confirmation, and note cancellation policy.',
    daysBeforeEvent: 180,
    priority: 'critical',
    category: 'Venue',
    minDaysNotice: 14,
  },
  {
    title: 'Set overall budget',
    description: 'Agree on total spending limit and allocate across categories.',
    daysBeforeEvent: 170,
    priority: 'critical',
    category: 'Budget',
  },
  {
    title: 'Create guest list',
    description: 'Compile all invitees with contact details. Confirm dietary needs.',
    daysBeforeEvent: 150,
    priority: 'high',
    category: 'Guests',
  },
  {
    title: 'Send save-the-dates or invitations',
    description: 'Dispatch invitations (digital or print) with RSVP deadline.',
    daysBeforeEvent: 120,
    priority: 'high',
    category: 'Communication',
    dependsOnTitles: ['Create guest list'],
  },
  {
    title: 'Confirm catering / food arrangements',
    description: 'Book caterer, confirm menu, quantities, and service logistics.',
    daysBeforeEvent: 90,
    priority: 'critical',
    category: 'Catering',
    minDaysNotice: 7,
  },
  {
    title: 'Collect RSVPs',
    description: 'Chase outstanding RSVPs and finalise headcount.',
    daysBeforeEvent: 45,
    priority: 'high',
    category: 'Guests',
    dependsOnTitles: ['Send save-the-dates or invitations'],
  },
  {
    title: 'Confirm final headcount with vendors',
    description: 'Share final guest count with caterer, venue, and transport.',
    daysBeforeEvent: 21,
    priority: 'critical',
    category: 'Logistics',
    dependsOnTitles: ['Collect RSVPs'],
    minDaysNotice: 7,
  },
  {
    title: 'Prepare event-day schedule',
    description: 'Write a minute-by-minute run-of-show for all vendors and hosts.',
    daysBeforeEvent: 14,
    priority: 'high',
    category: 'Logistics',
  },
  {
    title: 'Confirm all vendor bookings',
    description: 'Call each vendor to verify timing, access, and payment.',
    daysBeforeEvent: 7,
    priority: 'critical',
    category: 'Vendors',
    minDaysNotice: 2,
  },
  {
    title: 'Venue walk-through',
    description: 'Visit the venue, note layout, confirm setup logistics.',
    daysBeforeEvent: 7,
    priority: 'high',
    category: 'Venue',
    minDaysNotice: 2,
  },
  {
    title: 'Event day — setup',
    description: 'Arrive early for decoration, AV checks, and final coordination.',
    daysBeforeEvent: 0,
    priority: 'critical',
    category: 'Event Day',
  },
  {
    title: 'Send thank-you messages',
    description: 'Express appreciation to guests, vendors, and volunteers.',
    daysBeforeEvent: -7, // after the event
    priority: 'medium',
    category: 'Follow-Up',
  },
  {
    title: 'Settle outstanding vendor invoices',
    description: 'Pay remaining balances and request receipts.',
    daysBeforeEvent: -14,
    priority: 'high',
    category: 'Budget',
  },
];

// ----------------------------------------------------------------
// Wedding-specific templates
// ----------------------------------------------------------------
const WEDDING_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Book officiant',
    description: 'Hire and brief the person officiating the ceremony.',
    daysBeforeEvent: 180,
    priority: 'critical',
    category: 'Ceremony',
  },
  {
    title: 'Book photographer and videographer',
    description: 'Review portfolios, agree on packages, sign contracts.',
    daysBeforeEvent: 180,
    priority: 'critical',
    category: 'Photography',
  },
  {
    title: 'Choose wedding attire',
    description: 'Shop for and order wedding outfits, accounting for alterations lead time.',
    daysBeforeEvent: 150,
    priority: 'high',
    category: 'Attire',
  },
  {
    title: 'Plan honeymoon or post-event trip',
    description: 'Book travel and accommodation if applicable.',
    daysBeforeEvent: 120,
    priority: 'medium',
    category: 'Travel',
  },
  {
    title: 'Choose flowers and decoration vendors',
    description: 'Meet florists, agree on arrangements, table centrepieces.',
    daysBeforeEvent: 90,
    priority: 'high',
    category: 'Decoration',
  },
  {
    title: 'Rehearsal and rehearsal dinner',
    description: 'Coordinate ceremony run-through and post-rehearsal dinner.',
    daysBeforeEvent: 1,
    priority: 'high',
    category: 'Ceremony',
    minDaysNotice: 3,
  },
];

// ----------------------------------------------------------------
// Birthday-specific templates
// ----------------------------------------------------------------
const BIRTHDAY_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Choose party theme and activities',
    description: 'Decide on theme and matching activities that suit the guest of honour.',
    daysBeforeEvent: 60,
    priority: 'high',
    category: 'Theme',
  },
  {
    title: 'Order cake or desserts',
    description: 'Place order specifying flavour, allergens, size, and pickup/delivery.',
    daysBeforeEvent: 30,
    priority: 'high',
    category: 'Catering',
  },
  {
    title: 'Organise entertainment or activities',
    description: 'Book entertainment (e.g., DJ, magician, photo booth, games).',
    daysBeforeEvent: 45,
    priority: 'medium',
    category: 'Entertainment',
  },
  {
    title: 'Prepare party favours or gifts',
    description: 'Source and personalise any take-home gifts for guests.',
    daysBeforeEvent: 14,
    priority: 'low',
    category: 'Decoration',
  },
];

// ----------------------------------------------------------------
// Community event–specific templates
// ----------------------------------------------------------------
const COMMUNITY_TEMPLATES: TaskTemplate[] = [
  {
    title: 'Obtain permits and approvals',
    description: 'Apply for public gathering permits, noise licences, and insurance as required.',
    daysBeforeEvent: 180,
    priority: 'critical',
    category: 'Legal',
  },
  {
    title: 'Recruit volunteers',
    description: 'Assign volunteer roles: registration, hospitality, setup/teardown, accessibility support.',
    daysBeforeEvent: 90,
    priority: 'high',
    category: 'Logistics',
  },
  {
    title: 'Set up event registration or ticketing',
    description: 'Create an online or paper registration system. Share link publicly.',
    daysBeforeEvent: 90,
    priority: 'high',
    category: 'Communication',
  },
  {
    title: 'Arrange accessibility accommodations',
    description: 'Confirm ramp access, sign language interpreters, quiet spaces, and dietary options.',
    daysBeforeEvent: 60,
    priority: 'critical',
    category: 'Accessibility',
  },
  {
    title: 'Prepare safety and emergency plan',
    description: 'Identify first-aid contacts, exit routes, and emergency procedures.',
    daysBeforeEvent: 30,
    priority: 'critical',
    category: 'Safety',
  },
  {
    title: 'Brief volunteers and staff',
    description: 'Run a final briefing covering roles, safety, and schedule.',
    daysBeforeEvent: 3,
    priority: 'high',
    category: 'Logistics',
    minDaysNotice: 3,
  },
];

const TYPE_TEMPLATES: Record<EventType, TaskTemplate[]> = {
  wedding: WEDDING_TEMPLATES,
  birthday: BIRTHDAY_TEMPLATES,
  community: COMMUNITY_TEMPLATES,
};

/**
 * Extra tasks that only make sense at larger guest counts. Kept explicit so
 * complexity is transparent rather than a hidden multiplier.
 */
function getComplexityTemplates(eventType: EventType, guestCount: number): TaskTemplate[] {
  const extras: TaskTemplate[] = [];
  if (guestCount >= 100) {
    extras.push({
      title: 'Confirm overflow parking and guest transport',
      description: 'Check parking capacity and arrange shuttles or carpooling if needed.',
      daysBeforeEvent: 30,
      priority: 'high',
      category: 'Logistics',
    });
  }
  if (eventType === 'wedding' && guestCount >= 80) {
    extras.push({
      title: 'Arrange guest accommodation block',
      description: 'Negotiate a room block and share booking instructions with guests.',
      daysBeforeEvent: 120,
      priority: 'medium',
      category: 'Travel',
    });
  }
  if (eventType === 'community' && guestCount >= 200) {
    extras.push({
      title: 'Confirm crowd safety and medical support',
      description: 'Agree on crowd management, first aid, and emergency access with the venue.',
      daysBeforeEvent: 45,
      priority: 'critical',
      category: 'Safety',
    });
  }
  return extras;
}

// ----------------------------------------------------------------
// Generation
// ----------------------------------------------------------------

/**
 * Generate a full task list for an event.
 * Uses local midnight for all comparisons so time-of-day cannot shift a
 * deadline by one calendar day. Tasks that would have been due before today
 * are compressed to today (short-notice planning) rather than placed in the past.
 */
export function generateTimeline(
  eventType: EventType,
  eventDateStr: string,
  today: Date = new Date(),
  guestCount = 0
): Task[] {
  const rawEventDate = parseISO(eventDateStr);
  if (!isValid(rawEventDate)) return [];

  const baseToday = startOfDay(today);
  const eventDate = startOfDay(rawEventDate);
  const daysUntil = differenceInDays(eventDate, baseToday);
  const templates = [
    ...SHARED_TEMPLATES,
    ...TYPE_TEMPLATES[eventType],
    ...getComplexityTemplates(eventType, guestCount),
  ];

  // Sort by daysBeforeEvent descending (furthest from event first)
  templates.sort((a, b) => b.daysBeforeEvent - a.daysBeforeEvent);

  const titleToId: Record<string, string> = {};
  const tasks: Task[] = [];

  for (const tmpl of templates) {
    // Skip tasks that need more lead time than available.
    if (tmpl.minDaysNotice !== undefined && daysUntil < tmpl.minDaysNotice) {
      continue;
    }

    const dueDate =
      tmpl.daysBeforeEvent >= 0
        ? subDays(eventDate, tmpl.daysBeforeEvent)
        : addDays(eventDate, Math.abs(tmpl.daysBeforeEvent));

    // Clamp past due dates to today for short-notice events.
    const clampedDue = isBefore(dueDate, baseToday) ? baseToday : dueDate;

    const id = nanoid();
    titleToId[tmpl.title] = id;

    tasks.push({
      id,
      title: tmpl.title,
      description: tmpl.description,
      dueDate: format(clampedDue, 'yyyy-MM-dd'),
      priority: tmpl.priority,
      status: 'pending' as TaskStatus,
      category: tmpl.category,
      dependsOn: [],
      isGenerated: true,
    });
  }

  // Resolve dependencies by title -> id.
  return tasks.map((task) => {
    const tmpl = templates.find((t) => t.title === task.title);
    if (!tmpl?.dependsOnTitles) return task;
    return {
      ...task,
      dependsOn: tmpl.dependsOnTitles
        .map((title) => titleToId[title])
        .filter((id): id is string => Boolean(id)),
    };
  });
}

/** Mark a task complete. */
export function completeTask(tasks: Task[], taskId: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    return { ...t, status: 'complete', completedAt: new Date().toISOString() };
  });
}

/** Reopen a completed task. */
export function reopenTask(tasks: Task[], taskId: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const { completedAt: _completedAt, ...rest } = t;
    return { ...rest, status: 'pending' };
  });
}

/**
 * Derive effective statuses for display: tasks whose dependencies are not
 * complete become blocked. Dependencies that no longer exist are ignored,
 * which prevents permanent accidental blocking after a replan or deletion.
 */
export function auditTasks(tasks: Task[], today: Date = new Date()): Task[] {
  const completedIds = new Set(tasks.filter((t) => t.status === 'complete').map((t) => t.id));
  const existingIds = new Set(tasks.map((t) => t.id));
  const baseToday = startOfDay(today);

  return tasks.map((task) => {
    if (task.status === 'complete') return task;

    const liveDependencies = task.dependsOn.filter((depId) => existingIds.has(depId));
    const isBlocked = liveDependencies.some((depId) => !completedIds.has(depId));

    return { ...task, status: isBlocked ? 'blocked' : task.status };
  });
}

/** True when a task is incomplete and its due date is before today. */
export function isTaskOverdue(task: Task, today: Date = new Date()): boolean {
  if (task.status === 'complete') return false;
  const due = parseISO(task.dueDate);
  if (!isValid(due)) return false;
  return isBefore(startOfDay(due), startOfDay(today));
}

/**
 * Calculate weighted completion percentage.
 * Critical tasks weigh 3x, high 2x, medium 1x, low 0.5x.
 */
export function completionPercent(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const weights: Record<TaskPriority, number> = { critical: 3, high: 2, medium: 1, low: 0.5 };
  let totalWeight = 0;
  let completedWeight = 0;
  for (const t of tasks) {
    const w = weights[t.priority];
    totalWeight += w;
    if (t.status === 'complete') completedWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round((completedWeight / totalWeight) * 100);
}

/** Add a custom user task. */
export function addTask(tasks: Task[], task: Omit<Task, 'id' | 'isGenerated'>): Task[] {
  const newTask: Task = {
    ...task,
    title: task.title.trim(),
    description: task.description.trim(),
    id: nanoid(),
    isGenerated: false,
  };
  return [...tasks, newTask];
}

/** Edit an existing task. */
export function editTask(tasks: Task[], taskId: string, patch: Partial<Task>): Task[] {
  return tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
}

/** Delete a task. */
export function deleteTask(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.id !== taskId);
}
