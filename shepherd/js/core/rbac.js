/**
 * Role-based access control.
 *
 * A permission is `<resource>:<action>` — `members:read`, `finance:approve`.
 * Roles hold sets of them; a user holds one primary role plus optional
 * per-user grants and revocations, because real churches always have the
 * elder who also keeps the books.
 *
 * Checks happen in three places, deliberately overlapping:
 *   1. Navigation — a module the user cannot read is not shown.
 *   2. The router — deep links to it are refused.
 *   3. The database — writes to a collection they cannot write are rejected.
 * The third is the one that matters; the first two are courtesy.
 */

/** @typedef {keyof typeof ROLES} RoleId */

export const ACTIONS = /** @type {const} */ (['read', 'write', 'delete', 'approve', 'export', 'manage']);

/** Every resource the platform guards, with a human label for the settings UI. */
export const RESOURCES = {
  dashboard:     'Dashboard',
  members:       'Member records',
  care:          'Pastoral care & follow-ups',
  counseling:    'Counselling notes',
  leadership:    'Leadership hub',
  journal:       'Leadership journal',
  worship:       'Worship & music',
  preaching:     'Preaching & sermons',
  prayer:        'Prayer centre',
  events:        'Events',
  finance:       'Finance',
  documents:     'Document vault',
  knowledge:     'Knowledge centre',
  communications:'Communications',
  reports:       'Reports',
  equip:         'Equip — learning & training',
  assistant:     'AI assistant',
  settings:      'Church settings',
  users:         'Users & roles',
  audit:         'Audit log',
  tenants:       'Churches (platform)',
};

const ALL = Object.keys(RESOURCES).map((r) => `${r}:*`);

/**
 * Role definitions, ordered from most to least privileged. `rank` drives
 * "who may assign this role" — nobody can grant a role above their own.
 */
export const ROLES = {
  super_admin: {
    label: 'Super Admin',
    rank: 100,
    description: 'Platform owner. Every church, every setting, including billing and tenant creation.',
    permissions: ALL,
  },
  platform_admin: {
    label: 'Platform Administrator',
    rank: 90,
    description: 'Supports churches on the platform. Can create and configure tenants, never reads their pastoral or financial records.',
    permissions: [
      'tenants:*', 'settings:read', 'settings:write', 'users:read', 'users:write',
      'audit:read', 'dashboard:read',
    ],
  },
  church_admin: {
    label: 'Church Administrator',
    rank: 80,
    description: 'Runs this church on Shepherd: users, settings, and every module inside it.',
    permissions: [
      'dashboard:*', 'members:*', 'care:*', 'leadership:*', 'journal:read', 'worship:*', 'preaching:*',
      'prayer:*', 'events:*', 'finance:*', 'documents:*', 'knowledge:*', 'equip:*',
      'communications:*', 'reports:*', 'assistant:*', 'settings:*', 'users:*', 'audit:read',
    ],
  },
  senior_pastor: {
    label: 'Senior Pastor',
    rank: 70,
    description: 'Full pastoral oversight, including counselling notes and financial summaries.',
    permissions: [
      'dashboard:*', 'members:*', 'care:*', 'counseling:*', 'leadership:*', 'journal:read', 'worship:read',
      'worship:write', 'preaching:*', 'prayer:*', 'events:*', 'finance:read', 'finance:approve',
      'finance:export', 'documents:*', 'knowledge:*', 'equip:*', 'communications:*', 'reports:*',
      'assistant:*', 'settings:read', 'users:read', 'audit:read',
    ],
  },
  pastor: {
    label: 'Pastor',
    rank: 60,
    description: 'Shepherds people: member care, counselling, prayer, preaching.',
    permissions: [
      'dashboard:read', 'members:read', 'members:write', 'care:*', 'counseling:*',
      'leadership:read', 'journal:read', 'worship:read', 'preaching:*', 'prayer:*', 'events:read',
      'events:write', 'documents:read', 'knowledge:read', 'knowledge:write', 'equip:read',
      'communications:read', 'communications:write', 'reports:read', 'assistant:*',
    ],
  },
  elder: {
    label: 'Elder',
    rank: 50,
    description: 'Shares governance and care, without counselling files or finance detail.',
    permissions: [
      'dashboard:read', 'members:read', 'care:read', 'care:write', 'leadership:read',
      'leadership:write', 'journal:read', 'worship:read', 'preaching:read', 'prayer:read', 'prayer:write',
      'events:read', 'events:write', 'documents:read', 'knowledge:read', 'equip:read',
      'communications:read', 'reports:read', 'assistant:read', 'assistant:write',
    ],
  },
  ministry_head: {
    label: 'Ministry Head',
    rank: 40,
    description: 'Runs one ministry: its people, rota, events and requests, and its own workspace in the leadership hub. Reads the whole leadership hub, but can only write its own ministry\'s tasks and annual plan — not another ministry\'s, nor church-wide meetings and decisions.',
    permissions: [
      'dashboard:read', 'members:read', 'care:read', 'worship:read', 'worship:write',
      'prayer:read', 'prayer:write', 'events:read', 'events:write', 'documents:read',
      'knowledge:read', 'equip:read', 'communications:read', 'communications:write', 'reports:read',
      'assistant:read', 'assistant:write', 'leadership:read', 'journal:read',
    ],
  },
  treasurer: {
    label: 'Treasurer',
    rank: 40,
    description: 'Owns the books. Finance in full; people only as far as giving requires.',
    permissions: [
      'dashboard:read', 'members:read', 'finance:*', 'documents:read', 'documents:write',
      'reports:read', 'reports:export', 'events:read', 'equip:read', 'assistant:read', 'assistant:write',
      'audit:read',
    ],
  },
  secretary: {
    label: 'Secretary',
    rank: 40,
    description: 'Keeps the records: minutes, documents, announcements, member details.',
    permissions: [
      'dashboard:read', 'members:read', 'members:write', 'care:read', 'leadership:read',
      'leadership:write', 'journal:read', 'events:*', 'documents:read', 'documents:write', 'knowledge:read',
      'knowledge:write', 'equip:read', 'communications:*', 'reports:read', 'reports:export',
      'assistant:read', 'assistant:write', 'prayer:read',
    ],
  },
  volunteer: {
    label: 'Volunteer',
    rank: 20,
    description: 'Serves on a team: their rota, their events, the prayer wall.',
    permissions: [
      'dashboard:read', 'worship:read', 'events:read', 'prayer:read', 'prayer:write',
      'knowledge:read', 'equip:read', 'assistant:read',
    ],
  },
  member: {
    label: 'Member',
    rank: 10,
    description: 'Optional congregation access: prayer wall, events, announcements.',
    permissions: ['dashboard:read', 'events:read', 'prayer:read', 'prayer:write', 'knowledge:read', 'equip:read'],
  },
};

export const ROLE_IDS = /** @type {RoleId[]} */ (Object.keys(ROLES));

/** @param {string} permission */
function expand(permission) {
  const [resource, action] = String(permission).split(':');
  return { resource, action: action || 'read' };
}

/**
 * @param {{role?: string, grants?: string[], revocations?: string[], suspended?: boolean}|null} user
 * @param {string} permission e.g. `finance:approve`
 */
export function can(user, permission) {
  if (!user || user.suspended) return false;
  const { resource, action } = expand(permission);
  if (!resource) return false;

  const revocations = user.revocations || [];
  if (matches(revocations, resource, action)) return false;

  const grants = user.grants || [];
  if (matches(grants, resource, action)) return true;

  const role = ROLES[user.role];
  if (!role) return false;
  return matches(role.permissions, resource, action);
}

function matches(list, resource, action) {
  for (const entry of list) {
    const [entryResource, entryAction] = String(entry).split(':');
    if (entryResource !== resource && entryResource !== '*') continue;
    if (entryAction === '*' || entryAction === action) return true;
    // `manage` is the umbrella for destructive administration of a resource.
    if (entryAction === 'manage' && (action === 'delete' || action === 'approve')) return true;
    // Anyone who may write may also read.
    if (action === 'read' && ['write', 'delete', 'approve', 'export', 'manage'].includes(entryAction)) return true;
  }
  return false;
}

/** Every permission a user effectively holds — powers the "what can they see" preview. */
export function effectivePermissions(user) {
  const out = [];
  for (const resource of Object.keys(RESOURCES)) {
    for (const action of ACTIONS) {
      if (can(user, `${resource}:${action}`)) out.push(`${resource}:${action}`);
    }
  }
  return out;
}

/** Roles `user` is allowed to assign — never above their own rank. */
export function assignableRoles(user) {
  if (!can(user, 'users:write')) return [];
  const rank = ROLES[user.role] ? ROLES[user.role].rank : 0;
  return ROLE_IDS.filter((id) => ROLES[id].rank <= rank);
}

export function roleLabel(roleId) {
  return ROLES[roleId] ? ROLES[roleId].label : 'Unknown role';
}

/** Thrown by the database when a write is refused. Callers turn it into a toast. */
export class PermissionError extends Error {
  constructor(permission) {
    super(`You do not have permission to ${String(permission).replace(':', ' ')}.`);
    this.name = 'PermissionError';
    this.permission = permission;
  }
}

/** @throws {PermissionError} */
export function assertCan(user, permission) {
  if (!can(user, permission)) throw new PermissionError(permission);
  return true;
}
