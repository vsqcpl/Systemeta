import { ROLES, UserRole } from "./roles";

const {
  SUPER_ADMIN: SA,
  CLIENT_MANAGER: CM,
  PROJECT_MANAGER: PM,
  SENIOR_CONSULTANT: SC,
  CONSULTANT: CON,
  ACCOUNTS: ACC,
  CLIENT_CONTACT: CC,
} = ROLES;

export type AccessLevel = "full" | "view" | "own" | "limited" | null;

export const SCREEN_ACCESS: Record<string, Record<UserRole, AccessLevel>> = {
  // ── Shared ──────────────────────────────────────────────────────────────
  login:                    { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:"full",[ACC]:"full",[CC]:"full" },
  my_profile:               { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:"full",[ACC]:"full",[CC]:"full" },
  change_password:          { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:"full",[ACC]:"full",[CC]:"full" },
  home_module_selector:     { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:"full",[ACC]:"full",[CC]:"limited" },
  notification_panel:       { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:"full",[ACC]:"full",[CC]:null   },

  // ── Project Management ───────────────────────────────────────────────────
  portfolio_dashboard:      { [SA]:"full",[CM]:"view", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  project_dashboard:        { [SA]:"full",[CM]:"view", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:"limited"},
  project_setup_edit:       { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  task_list:                { [SA]:"full",[CM]:"view", [PM]:"full",[SC]:"view",[CON]:"own", [ACC]:null,  [CC]:null     },
  task_detail_create:       { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:"view",[CON]:"own", [ACC]:null,  [CC]:null     },
  resource_calendar:        { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:"view",[CON]:null,  [ACC]:null,  [CC]:null     },
  plan_change_approval:     { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },

  // ── Timesheet ────────────────────────────────────────────────────────────
  timesheet_daily_log:      { [SA]:"full",[CM]:"view", [PM]:"view",[SC]:"full",[CON]:"own", [ACC]:null,  [CC]:null     },
  timesheet_team_view:      { [SA]:"full",[CM]:"view", [PM]:"full",[SC]:"view",[CON]:null,  [ACC]:null,  [CC]:null     },
  my_tasks_cross_project:   { [SA]:"full",[CM]:"view", [PM]:"view",[SC]:"full",[CON]:"full",[ACC]:null,  [CC]:null     },
  leave_submit_track:       { [SA]:"full",[CM]:"own",  [PM]:"own", [SC]:"full",[CON]:"own", [ACC]:null,  [CC]:null     },
  leave_approval_queue:     { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"full",[CON]:null,  [ACC]:null,  [CC]:null     },
  travel_expenses:          { [SA]:"full",[CM]:"own",  [PM]:"view",[SC]:"full",[CON]:"own", [ACC]:"view",[CC]:null     },

  // ── Billing ──────────────────────────────────────────────────────────────
  billing_milestones:       { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:"full",[CC]:null     },
  monthly_billing_summary:  { [SA]:"full",[CM]:null,   [PM]:"view",[SC]:null,  [CON]:null,  [ACC]:"full",[CC]:null     },

  // ── Admin ─────────────────────────────────────────────────────────────────
  user_management:          { [SA]:"full",[CM]:null,   [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  system_configuration:     { [SA]:"full",[CM]:null,   [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  audit_log:                { [SA]:"full",[CM]:null,   [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },

  // ── AI Insights ──────────────────────────────────────────────────────────
  ai_task_estimation:       { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_delay_analysis:        { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_delay_prediction:      { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_weekly_summary:        { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_assignment_suggest:    { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_resource_optimization: { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_efficiency_metrics:    { [SA]:"full",[CM]:null,   [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  ai_co2_report:            { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:"full",[CC]:null     },
  ai_milestone_insights:    { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:null,  [CON]:null,  [ACC]:"view",[CC]:null     },
  ai_schedule_clashes:      { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },
  ai_wbs_generation:        { [SA]:"full",[CM]:"full", [PM]:"full",[SC]:"view",[CON]:"view",[ACC]:null,  [CC]:null     },

  // ── Client Portal ─────────────────────────────────────────────────────────
  client_project_status:    { [SA]:"full",[CM]:null,   [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:"limited"},
  client_milestone_tracker: { [SA]:"full",[CM]:null,   [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:"limited"},

  // ── Client Manager CRM ────────────────────────────────────────────────────
  crm_dashboard:            { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_clients:              { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_contacts:             { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_calls:                { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_meetings:             { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_follow_ups:           { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_requirements:         { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_opportunities:        { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_escalations:          { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
  crm_reports:              { [SA]:"full",[CM]:"full", [PM]:null,  [SC]:null,  [CON]:null,  [ACC]:null,  [CC]:null     },
};

export const ACTION_PERMISSIONS: Record<string, UserRole[]> = {
  // ── Project ───────────────────────────────────────────────────────────────
  create_project:            [SA, PM],
  edit_project:              [SA, PM],
  delete_project:            [SA, PM],
  lock_unlock_plan:          [SA, PM],
  assign_resource_to_task:   [SA, PM],
  approve_plan_change:       [SA, PM],

  // ── Tasks ─────────────────────────────────────────────────────────────────
  create_edit_task:          [SA, PM],
  update_task_progress:      [SA, PM, SC, CON],

  // ── Timesheets ────────────────────────────────────────────────────────────
  log_time_entry:            [SA, SC, CON],
  view_team_timesheets:      [SA, PM, SC],

  // ── Leave ─────────────────────────────────────────────────────────────────
  submit_leave:              [SA, PM, SC, CON],
  approve_leave:             [SA, PM, SC],

  // ── Expenses ──────────────────────────────────────────────────────────────
  add_expense:               [SA, SC, CON],
  view_all_expenses:         [SA, PM],

  // ── Billing ───────────────────────────────────────────────────────────────
  mark_milestone_achieved:   [SA, PM, ACC],
  generate_billing_summary:  [SA, ACC],
  mark_summary_invoiced:     [SA, ACC],
  view_billing_amounts:      [SA, PM, ACC],
  export_billing_csv:        [SA, ACC],

  // ── Admin ─────────────────────────────────────────────────────────────────
  create_edit_users:         [SA],
  change_user_roles:         [SA],
  deactivate_users:          [SA],
  delete_user:               [SA],
  view_audit_log:            [SA],
  configure_system:          [SA],
  override_any_approval:     [SA],
  unlock_any_plan:           [SA],

  // ── AI ────────────────────────────────────────────────────────────────────
  use_ai_task_estimation:    [SA, CM, PM, SC, CON],
  use_ai_delay_analysis:     [SA, CM, PM, SC, CON],
  use_ai_weekly_summary:     [SA, CM, PM, SC, CON],
  use_ai_assignment_suggest: [SA, CM, PM, SC, CON],
  view_ai_efficiency:        [SA, PM],
  use_ai_co2_report:         [SA, CM, PM, ACC],
  view_ai_milestone_insights:[SA, CM, PM, ACC],

  // ── Resource ──────────────────────────────────────────────────────────────
  assign_resources:          [SA, PM],
  view_resource_calendar:    [SA, PM, SC],

  // ── Client Manager ────────────────────────────────────────────────────────
  manage_clients:            [SA, CM],
  manage_contacts:           [SA, CM],
  manage_calls:              [SA, CM],
  manage_meetings:           [SA, CM],
  manage_follow_ups:         [SA, CM],
  manage_requirements:       [SA, CM],
  manage_opportunities:      [SA, CM],
  manage_escalations:        [SA, CM],
  generate_crm_reports:      [SA, CM],
  view_client_analytics:     [SA, CM],
};
