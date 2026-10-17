/**
 * Status workflow rules for NStarX Intake admin requests.
 *
 * Linear flow: Submitted -> In Review -> Planned -> In Progress -> Completed.
 * Rejected is allowed from any non-terminal state and can later be moved back
 * into the linear flow.
 * Terminal state Completed cannot be changed.
 */

export const VALID_STATUSES = [
  "Submitted",
  "In Review",
  "Planned",
  "In Progress",
  "Completed",
  "Rejected",
] as const;

export type RequestStatus = (typeof VALID_STATUSES)[number];

export const LINEAR_FLOW: RequestStatus[] = [
  "Submitted",
  "In Review",
  "Planned",
  "In Progress",
  "Completed",
];

const TERMINAL_STATUSES = new Set<RequestStatus>([]);

export function isTerminalStatus(_status: RequestStatus): boolean {
  return false;
}

/** Return true if a status change is allowed. Completed and Rejected can always be reopened. */
export function canChangeStatus(current: RequestStatus, next: RequestStatus): boolean {
  return validateStatusTransition(current, next).ok;
}

/**
 * Return the next valid linear status, or null if the status is already at the
 * end of the linear flow (Completed) or is not a linear state.
 */
export function getNextLinearStatus(status: RequestStatus): RequestStatus | null {
  const idx = LINEAR_FLOW.indexOf(status);
  if (idx === -1 || idx === LINEAR_FLOW.length - 1) return null;
  return LINEAR_FLOW[idx + 1];
}

/**
 * Validate a status transition and, when invalid, return a clear error message.
 */
export const validateStatusTransition = (
  current: RequestStatus,
  next: RequestStatus
): { ok: true } | { ok: false; error: string } => {
  if (!VALID_STATUSES.includes(current)) {
    return { ok: false, error: `Current status "${current}" is not a valid workflow state.` };
  }

  if (!VALID_STATUSES.includes(next)) {
    return { ok: false, error: `"${next}" is not a valid status value.` };
  }

  if (current === next) {
    return { ok: true };
  }

  // Completed and Rejected can be reopened to any open state
  if (current === "Completed" || current === "Rejected") {
    return { ok: true };
  }

  if (next === "Rejected") {
    return { ok: true };
  }

  const currentIndex = LINEAR_FLOW.indexOf(current);
  const nextIndex = LINEAR_FLOW.indexOf(next);

  if (nextIndex === currentIndex + 1) {
    return { ok: true };
  }

  if (nextIndex > currentIndex) {
    return {
      ok: false,
      error: `Invalid status transition: "${current}" can only move to "${LINEAR_FLOW[currentIndex + 1]}", not "${next}".`,
    };
  }

  return {
    ok: false,
    error: `Invalid status transition: "${current}" cannot move backwards to "${next}".`,
  };
};
