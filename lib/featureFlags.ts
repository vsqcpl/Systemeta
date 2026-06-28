import { canAccessScreen } from "./permissionHelpers";
import { UserRole } from "./roles";

export const AI_FLAGS = {
  task_estimation:    process.env.NEXT_PUBLIC_AI_TASK_ESTIMATION    !== "false",
  delay_analysis:     process.env.NEXT_PUBLIC_AI_DELAY_ANALYSIS     !== "false",
  weekly_summary:     process.env.NEXT_PUBLIC_AI_WEEKLY_SUMMARY     !== "false",
  assignment_suggest: process.env.NEXT_PUBLIC_AI_ASSIGNMENT_SUGGEST !== "false",
  efficiency_metrics: process.env.NEXT_PUBLIC_AI_EFFICIENCY_METRICS !== "false",
  co2_report:         process.env.NEXT_PUBLIC_AI_CO2_REPORT         !== "false",
  milestone_insights: process.env.NEXT_PUBLIC_AI_MILESTONE_INSIGHTS !== "false",
};

export type AiFeatureKey = keyof typeof AI_FLAGS;

/** Returns true only if BOTH the role has access AND the feature flag is on. */
export function canUseAiFeature(featureKey: AiFeatureKey, role: UserRole): boolean {
  return (AI_FLAGS[featureKey] === true) && canAccessScreen(`ai_${featureKey}`, role);
}

/** True if at least one AI feature is accessible for this role and enabled. */
export function hasAnyAiAccess(role: UserRole): boolean {
  return (Object.keys(AI_FLAGS) as AiFeatureKey[]).some(key => canUseAiFeature(key, role));
}
