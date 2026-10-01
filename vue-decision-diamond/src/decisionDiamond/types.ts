import type { EntityId } from './entities';

/** A single AND-joined rule row.
 *
 *  `entity` distinguishes Deal-scoped rules (the default, matching the
 *  triggering record's fields) from Contact-scoped rules (the shared
 *  cross-entity category). Older configs without `entity` are treated
 *  as 'deal' for backward compatibility.
 *
 *  For `entity === 'contact'`:
 *   - `category` is one of: 'tags' | 'standard' | 'constant' | 'custom'
 *   - `field` is the contact attribute id (or 'tags' when category='tags')
 *
 *  For `entity === 'deal'` (or undefined):
 *   - `category` is unused (legacy)
 *   - `field` is the deal field id (dealValue, dealStage, etc.)
 */
export type DDCondition = {
  id: string;
  entity?: 'deal' | 'contact';
  subject: string;
  category: string;
  field: string;
  operator: string;
  values: string[];
};

export type DDBlock = {
  id: string;
  conditions: DDCondition[];
};

export type DDGroup = {
  id: string;
  targetFlowId: string;
  targetName: string;
  blocks: DDBlock[];
};

export type DecisionDiamondConfig = {
  groups: DDGroup[];
  defaultRouting: string;
  boundEntity?: EntityId;
};

export type CellStatus = 'setupRequired' | 'readyToPublish' | 'published';

export type BuilderNode = {
  id: string;
  type: 'trigger' | 'decision' | 'action';
  title: string;
  subtitle?: string;
  /** Stable catalog slug — `automationIcons.json` slug or `entity:<id>.<x>` */
  name?: string;
  x: number;
  y: number;
  status?: CellStatus;
  warning?: boolean;
  iconSvg?: string;
  accent?: string;
  /** Shared identifier across decision diamonds that were split from
   *  the same save. Used by the editor's Save handler to clean up all
   *  siblings before creating the new split — so the on-canvas diamond
   *  count always equals the sequence count in the saved config. */
  groupKey?: string;
};

export type BuilderEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}`;
}
