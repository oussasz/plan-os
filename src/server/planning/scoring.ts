import type { AllocationContract } from "./allocation-contract";
import { rankByUrgencyPressure } from "./allocation-contract";

/** Ranking-only — no score→hours mapping. Use allocation contracts for execution. */
export function rankProjectsByUrgency(
  contracts: Map<string, AllocationContract>
): AllocationContract[] {
  return rankByUrgencyPressure(contracts);
}
