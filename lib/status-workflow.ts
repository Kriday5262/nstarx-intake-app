/**
 * Status values for NStarX Intake admin requests.
 *
 * No workflow enforcement: admins may set any status on any request.
 */

export const VALID_STATUSES = [
  "Submitted",
  "Not Started",
  "In Progress",
  "In Review",
  "Completed",
  "Rejected",
] as const;

export type RequestStatus = (typeof VALID_STATUSES)[number];

/**
 * Kept for backward compatibility; always returns true so transitions are
 * completely freeform.
 */
export function canChangeStatus(_current: RequestStatus, _next: RequestStatus): boolean {
  return true;
}

/** @deprecated Use canChangeStatus or compare values directly. */
export function getNextLinearStatus(_status: RequestStatus): null {
  return null;
}

/** @deprecated Transitions are unrestricted. */
export function isTerminalStatus(_status: RequestStatus): boolean {
  return false;
}

/** @deprecated Transitions are unrestricted; always returns { ok: true }. */
export const validateStatusTransition = (
  _current: RequestStatus,
  _next: RequestStatus
): { ok: true } | { ok: false; error: string } => {
  return { ok: true };
};
