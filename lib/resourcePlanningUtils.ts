import { Consultant, User, Task, Timesheet, TimesheetEntry, Project } from "./data/types";

/**
 * Calculates actual hours from punchInTime and punchOutTime on a timesheet entry.
 * Format expected: "HH:MM" or "HH:MM:SS" or ISO string.
 * Fallback: entry.hours
 */
export function parsePunchHours(entry: TimesheetEntry): number {
  if (entry.punchInTime && entry.punchOutTime) {
    try {
      const parseTimeToMinutes = (timeStr: string): number | null => {
        if (!timeStr) return null;
        if (timeStr.includes("T")) {
          const d = new Date(timeStr);
          if (!isNaN(d.getTime())) {
            return d.getHours() * 60 + d.getMinutes();
          }
        }
        const parts = timeStr.split(":").map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          return parts[0] * 60 + parts[1];
        }
        return null;
      };

      const inMins = parseTimeToMinutes(entry.punchInTime);
      const outMins = parseTimeToMinutes(entry.punchOutTime);

      if (inMins !== null && outMins !== null && outMins > inMins) {
        return Math.round(((outMins - inMins) / 60) * 100) / 100;
      }
    } catch {
      // Fallback below
    }
  }
  return entry.hours || 0;
}

/**
 * Collects all tasks from data.tasks regardless of array or object state
 */
export function flattenTasks(tasksData: any): Task[] {
  if (!tasksData) return [];
  if (Array.isArray(tasksData)) return tasksData;
  return [
    ...(tasksData.todo || []),
    ...(tasksData.inprogress || []),
    ...(tasksData.review || []),
    ...(tasksData.done || []),
  ];
}

/**
 * Calculates planned task hours for a specific employee.
 * Rules:
 * - If multiple assignees exist, check for personal estimate or split estimate equally.
 */
export function calculateEmployeePlannedHours(
  employeeId: string,
  employeeName: string,
  allTasks: Task[],
  selectedProjectId?: string
): number {
  let planned = 0;
  const empIdLower = (employeeId || "").toLowerCase();
  const empNameLower = (employeeName || "").toLowerCase();

  allTasks.forEach((task) => {
    if (selectedProjectId && selectedProjectId !== "all" && task.project !== selectedProjectId) {
      return;
    }

    const assignees = task.assignees && task.assignees.length > 0
      ? task.assignees
      : task.assignee
      ? [task.assignee]
      : [];

    if (assignees.length === 0) return;

    const isAssigned = assignees.some((a) => {
      const aLower = (a || "").toLowerCase();
      return aLower === empIdLower || aLower === empNameLower;
    });

    if (!isAssigned) return;

    const taskEst = task.estimate || 0;
    if (taskEst <= 0) return;

    // Check if subtask or personal estimate exists for this employee
    const personalSubtasks = task.subtasks?.filter((st: any) => {
      const stAssignee = (st.assignee || "").toLowerCase();
      return stAssignee === empIdLower || stAssignee === empNameLower;
    });

    if (personalSubtasks && personalSubtasks.length > 0) {
      // If personal subtasks exist with estimates or equal share
      planned += taskEst / assignees.length;
    } else {
      planned += taskEst / assignees.length;
    }
  });

  return Math.round(planned * 10) / 10;
}

/**
 * Calculates actual punched hours and approved logged hours for an employee.
 * Ignore rejected timesheets.
 * Capacity = submitted/approved work weeks * 40.
 */
export function calculateEmployeeActualAndLoggedHours(
  employeeId: string,
  employeeName: string,
  timesheets: Timesheet[],
  selectedProjectId?: string
): { loggedHours: number; actualHours: number; submittedWeeksCount: number } {
  let loggedHours = 0;
  let actualHours = 0;
  const submittedWeeks = new Set<string>();

  const empIdLower = (employeeId || "").toLowerCase();
  const empNameLower = (employeeName || "").toLowerCase();

  (timesheets || []).forEach((ts: any) => {
    const tsConsultant = (ts.consultant || "").toLowerCase();
    if (tsConsultant !== empIdLower && tsConsultant !== empNameLower) {
      return;
    }

    // Ignore rejected timesheets
    if (ts.status === "rejected" || ts.status === "Rejected") {
      return;
    }

    let hasMatchingEntries = false;

    if (ts.entries && Array.isArray(ts.entries)) {
      ts.entries.forEach((entry: TimesheetEntry) => {
        if (
          selectedProjectId &&
          selectedProjectId !== "all" &&
          entry.project !== selectedProjectId
        ) {
          return;
        }

        hasMatchingEntries = true;
        const entryHours = entry.hours || 0;
        const punchHours = parsePunchHours(entry);

        loggedHours += entryHours;
        actualHours += punchHours;
      });
    }

    if (hasMatchingEntries || (ts.entries && ts.entries.length > 0 && !selectedProjectId)) {
      submittedWeeks.add(ts.week || "default");
    }
  });

  return {
    loggedHours: Math.round(loggedHours * 10) / 10,
    actualHours: Math.round(actualHours * 10) / 10,
    submittedWeeksCount: submittedWeeks.size,
  };
}

export interface EmployeeResourceMetrics {
  id: string;
  name: string;
  role: string;
  dept: string;
  avatar: string;
  color: string;
  skills: string[];
  plannedHours: number;
  actualHours: number;
  loggedHours: number;
  capacityHours: number;
  utilisationPercent: number;
  efficiencyPercent: number;
  status: "Over-allocated" | "Optimal" | "Under-utilized" | "New Employee";
  projects: string[]; // Project names or IDs
}

/**
 * Computes complete metrics for an employee using real database records.
 */
export function getEmployeeResourceMetrics(
  employee: Consultant | User | any,
  allTasks: Task[],
  timesheets: Timesheet[],
  projectsList: Project[],
  selectedProjectId?: string
): EmployeeResourceMetrics {
  const empId = employee.id || employee.name;
  const empName = employee.name || employee.id;
  const role = employee.role || "Consultant";
  const dept = employee.dept || employee.department || "Consulting";
  const avatar =
    employee.avatar ||
    (empName ? empName.substring(0, 2).toUpperCase() : "EM");
  const color = employee.color || "#4f46e5";
  const skills = employee.skills || ["Consulting", "Project Delivery"];

  const plannedHours = calculateEmployeePlannedHours(
    empId,
    empName,
    allTasks,
    selectedProjectId
  );

  const { loggedHours, actualHours, submittedWeeksCount } =
    calculateEmployeeActualAndLoggedHours(
      empId,
      empName,
      timesheets,
      selectedProjectId
    );

  const capacityHours = submittedWeeksCount * 40;

  // Utilisation = (Total Logged Hours / Total Capacity) * 100, max 100%
  let rawUtilisation = capacityHours > 0 ? (loggedHours / capacityHours) * 100 : 0;
  const utilisationPercent = Math.min(100, Math.round(rawUtilisation));

  // Efficiency = (Total Planned Hours / Total Actual Hours) * 100
  const rawEfficiency = actualHours > 0 ? (plannedHours / actualHours) * 100 : 0;
  const efficiencyPercent = Math.round(rawEfficiency);

  // Assigned projects
  const assignedProjects = projectsList.filter((p) => {
    if (selectedProjectId && selectedProjectId !== "all" && p.id !== selectedProjectId) {
      return false;
    }
    const team = p.team || [];
    const empIdLower = empId.toLowerCase();
    const empNameLower = empName.toLowerCase();
    return (
      team.some((t: string) => t.toLowerCase() === empIdLower || t.toLowerCase() === empNameLower) ||
      (p.manager || "").toLowerCase() === empIdLower ||
      (p.manager || "").toLowerCase() === empNameLower
    );
  }).map((p) => p.name || p.id);

  // Status calculation
  let status: "Over-allocated" | "Optimal" | "Under-utilized" | "New Employee" = "Optimal";
  if (submittedWeeksCount === 0 && loggedHours === 0) {
    status = "New Employee";
  } else if (rawUtilisation > 100 || (submittedWeeksCount > 0 && loggedHours / submittedWeeksCount > 40)) {
    status = "Over-allocated";
  } else if (rawUtilisation < 50) {
    status = "Under-utilized";
  }

  return {
    id: empId,
    name: empName,
    role,
    dept,
    avatar,
    color,
    skills,
    plannedHours,
    actualHours,
    loggedHours,
    capacityHours,
    utilisationPercent,
    efficiencyPercent,
    status,
    projects: assignedProjects,
  };
}

/**
 * Computes aggregated system-wide Resource Planning metrics
 */
export function getOverallResourceSummary(metricsList: EmployeeResourceMetrics[]) {
  const totalCapacity = metricsList.reduce((acc, m) => acc + m.capacityHours, 0);
  const totalLogged = metricsList.reduce((acc, m) => acc + m.loggedHours, 0);
  const totalPlanned = metricsList.reduce((acc, m) => acc + m.plannedHours, 0);
  const totalActual = metricsList.reduce((acc, m) => acc + m.actualHours, 0);

  const overallUtilisation = totalCapacity > 0 ? Math.min(100, Math.round((totalLogged / totalCapacity) * 100)) : 0;
  const overallEfficiency = totalActual > 0 ? Math.round((totalPlanned / totalActual) * 100) : 0;
  const availableCapacity = Math.max(0, totalCapacity - totalLogged);
  const overallocatedCount = metricsList.filter((m) => m.status === "Over-allocated").length;

  return {
    totalCapacity,
    totalLogged,
    totalPlanned,
    totalActual,
    overallUtilisation,
    overallEfficiency,
    availableCapacity,
    overallocatedCount,
  };
}
