import { canAccessScreen } from "./permissionHelpers";
import { UserRole } from "./roles";

export const AI_FLAGS = {
  task_estimation:    process.env.NEXT_PUBLIC_AI_TASK_ESTIMATION    !== "false",
  delay_analysis:     process.env.NEXT_PUBLIC_AI_DELAY_ANALYSIS     !== "false",
  delay_prediction:   process.env.NEXT_PUBLIC_AI_DELAY_PREDICTION   !== "false",
  weekly_summary:     process.env.NEXT_PUBLIC_AI_WEEKLY_SUMMARY     !== "false",
  assignment_suggest: process.env.NEXT_PUBLIC_AI_ASSIGNMENT_SUGGEST !== "false",
  resource_optimization: process.env.NEXT_PUBLIC_AI_RESOURCE_OPT   !== "false",
  efficiency_metrics: process.env.NEXT_PUBLIC_AI_EFFICIENCY_METRICS !== "false",
  co2_report:         process.env.NEXT_PUBLIC_AI_CO2_REPORT         !== "false",
  milestone_insights: process.env.NEXT_PUBLIC_AI_MILESTONE_INSIGHTS !== "false",
  schedule_clashes:   process.env.NEXT_PUBLIC_AI_SCHEDULE_CLASHES   !== "false",
  wbs_generation:     process.env.NEXT_PUBLIC_AI_WBS_GENERATION     !== "false",
};

export type AiFeatureKey = keyof typeof AI_FLAGS;

/** Returns true only if BOTH the role has access AND the feature flag is on. */
export function canUseAiFeature(featureKey: AiFeatureKey, role: UserRole): boolean {
  if (AI_FLAGS[featureKey] !== true) return false;
  return canAccessScreen(`ai_${featureKey}`, role) || canAccessScreen("ai", role);
}

/** True if at least one AI feature is accessible for this role and enabled. */
export function hasAnyAiAccess(role: UserRole): boolean {
  return (Object.keys(AI_FLAGS) as AiFeatureKey[]).some(key => canUseAiFeature(key, role));
}
