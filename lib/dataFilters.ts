import { ROLES } from "./roles";
import { useAppStore } from "./store";

export interface FilterUser {
  id: string;
  name: string;
  email: string;
  role: string;
  projectIds?: string[];
  project_ids?: string[];
  clientIds?: string[];
  client_ids?: string[];
  clientId?: string;
  client_id?: string;
  reporteeIds?: string[];
  reportee_ids?: string[];
}

function getNormalizedRole(role: string): string {
  if (!role) return "";
  return role.toLowerCase().replace(/\s+/g, "_");
}

export function filterProjects(projects: any[], user: FilterUser) {
  const pIds = user.projectIds || user.project_ids || [];
  const cIds = user.clientIds || user.client_ids || [];
  const uClientId = user.clientId || user.client_id;
  const userRole = getNormalizedRole(user.role);

  switch (userRole) {
    case ROLES.SUPER_ADMIN:
    case ROLES.ACCOUNTS:
      return projects;
    case ROLES.CLIENT_MANAGER: {
      const storeClients = useAppStore.getState().data.clients || [];
      const clientNames = storeClients.map((c: any) => (c.companyName || "").toLowerCase());
      return projects.filter(p => {
        const pClient = (p.client || "").toLowerCase();
        return clientNames.includes(pClient);
      });
    }
    case ROLES.PROJECT_MANAGER:
      return projects.filter(p => p.manager === user.name || p.project_manager_id === user.id || p.team?.includes(user.id) || pIds.includes(p.id));
    case ROLES.SENIOR_CONSULTANT:
    case ROLES.CONSULTANT:
      return projects.filter(p => p.team?.includes(user.id) || pIds.includes(p.id));
    case ROLES.CLIENT_CONTACT:
      // Match by clientId (case-insensitive), or by clientIds array
      return projects.filter(p => {
        const pClient = (p.client || "").toLowerCase();
        const uClient = (uClientId || "").toLowerCase();
        return (
          (uClient && pClient === uClient) ||
          cIds.some(cid => (p.client_id || "").toLowerCase() === cid.toLowerCase()) ||
          cIds.some(cid => pClient === cid.toLowerCase())
        );
      });
    default:
      return [];
  }
}

export function filterTasks(tasks: any[], user: FilterUser) {
  const userRole = getNormalizedRole(user.role);

  switch (userRole) {
    case ROLES.SUPER_ADMIN:
    case ROLES.PROJECT_MANAGER:
    case ROLES.SENIOR_CONSULTANT:
    case ROLES.CLIENT_MANAGER:
      return tasks; // Scoped by projects
    case ROLES.CONSULTANT:
      return tasks.filter(t => t.assignee_id === user.id || t.assigneeId === user.id || t.assignee === user.id);
    default:
      return [];
  }
}

export function filterTimeEntries(entries: any[], user: FilterUser) {
  const pIds = user.projectIds || user.project_ids || [];
  const repIds = user.reporteeIds || user.reportee_ids || [];
  const userRole = getNormalizedRole(user.role);

  switch (userRole) {
    case ROLES.SUPER_ADMIN:
    case ROLES.ACCOUNTS:
      return entries;
    case ROLES.CLIENT_MANAGER: {
      const storeClients = useAppStore.getState().data.clients || [];
      const clientNames = storeClients.map((c: any) => (c.companyName || "").toLowerCase());
      const storeProjects = useAppStore.getState().data.projects || [];
      const clientProjects = storeProjects.filter(p => clientNames.includes((p.client || "").toLowerCase()));
      const clientProjectIds = clientProjects.map(p => p.id);
      return entries.filter(e => clientProjectIds.includes(e.project_id) || clientProjectIds.includes(e.project) || clientProjectIds.includes(e.projectId));
    }
    case ROLES.PROJECT_MANAGER:
      return entries.filter(e => pIds.includes(e.project_id) || pIds.includes(e.project));
    case ROLES.SENIOR_CONSULTANT:
      return entries.filter(e =>
        e.user_id === user.id ||
        e.consultant === user.id ||
        e.consultantId === user.id ||
        repIds.includes(e.user_id) ||
        repIds.includes(e.consultant) ||
        repIds.includes(e.consultantId)
      );
    case ROLES.CONSULTANT:
      return entries.filter(e => e.user_id === user.id || e.consultant === user.id || e.consultantId === user.id);
    default:
      return [];
  }
}

export function filterLeaveRecords(records: any[], user: FilterUser) {
  const repIds = user.reporteeIds || user.reportee_ids || [];
  const userRole = getNormalizedRole(user.role);

  switch (userRole) {
    case ROLES.SUPER_ADMIN:
      return records;
    case ROLES.PROJECT_MANAGER:
      // PM sees: their own leave + all requests from their direct reportees
      // If no reportees configured, PM sees all (full visibility like admin)
      return records.filter(r => {
        const isOwn = r.user_id === user.id || r.consultant === user.id || r.consultantId === user.id;
        const isReportee = repIds.length > 0
          ? repIds.includes(r.user_id) || repIds.includes(r.consultant) || repIds.includes(r.consultantId)
          : true; // No reportees configured → show all team leave
        return isOwn || isReportee;
      });
    case ROLES.SENIOR_CONSULTANT:
      return records.filter(r =>
        r.user_id === user.id ||
        r.consultant === user.id ||
        r.consultantId === user.id ||
        repIds.includes(r.user_id) ||
        repIds.includes(r.consultant) ||
        repIds.includes(r.consultantId)
      );
    case ROLES.CONSULTANT:
    case ROLES.CLIENT_MANAGER:
    case ROLES.ACCOUNTS:
      return records.filter(r => r.user_id === user.id || r.consultant === user.id || r.consultantId === user.id);
    default:
      return [];
  }
}

export function filterExpenses(expenses: any[], user: FilterUser) {
  const pIds = user.projectIds || user.project_ids || [];
  const repIds = user.reporteeIds || user.reportee_ids || [];
  const userRole = getNormalizedRole(user.role);

  switch (userRole) {
    case ROLES.SUPER_ADMIN:
      return expenses;
    case ROLES.CLIENT_MANAGER: {
      const storeClients = useAppStore.getState().data.clients || [];
      const clientNames = storeClients.map((c: any) => (c.companyName || "").toLowerCase());
      const storeProjects = useAppStore.getState().data.projects || [];
      const clientProjects = storeProjects.filter(p => clientNames.includes((p.client || "").toLowerCase()));
      const clientProjectIds = clientProjects.map(p => p.id);
      return expenses.filter(e => clientProjectIds.includes(e.project_id) || clientProjectIds.includes(e.project) || clientProjectIds.includes(e.projectId));
    }
    case ROLES.PROJECT_MANAGER:
      return expenses.filter(e => pIds.includes(e.project_id) || pIds.includes(e.project) || pIds.includes(e.projectId));
    case ROLES.SENIOR_CONSULTANT:
      return expenses.filter(e =>
        e.user_id === user.id ||
        e.consultant === user.id ||
        e.consultantId === user.id ||
        repIds.includes(e.user_id) ||
        repIds.includes(e.consultant) ||
        repIds.includes(e.consultantId)
      );
    case ROLES.CONSULTANT:
      return expenses.filter(e => e.user_id === user.id || e.consultant === user.id || e.consultantId === user.id);
    case ROLES.ACCOUNTS:
      return expenses.filter(e => e.is_client_billable === true || e.billable === true);
    default:
      return [];
  }
}

