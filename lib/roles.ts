export const ROLES = {
  SUPER_ADMIN:       "super_admin",
  CLIENT_MANAGER:    "client_manager",
  PROJECT_MANAGER:   "project_manager",
  SENIOR_CONSULTANT: "senior_consultant",
  CONSULTANT:        "consultant",
  ACCOUNTS:          "accounts",
  CLIENT_CONTACT:    "client_contact",
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

export const ALL_ROLES = Object.values(ROLES) as UserRole[];
