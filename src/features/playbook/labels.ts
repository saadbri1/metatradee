/**
 * Shared human labels for playbook rule groups, so the builder, the detail view,
 * and the rule editor never drift apart.
 *
 * The help text states plainly what these rules ARE: journaling and review
 * criteria. MetaTradee does not execute a playbook, and no copy here may imply
 * that it does.
 */
import type { RuleGroup } from './types';

export interface RuleGroupMeta {
  label: string;
  /** Short guidance shown under the section heading in the builder. */
  help: string;
}

export const RULE_GROUP_META: Record<RuleGroup, RuleGroupMeta> = {
  entry_rules: {
    label: 'Entry',
    help: 'What must be true before you take the trade.',
  },
  confirmation_rules: {
    label: 'Confirmation',
    help: 'Extra signals you require before committing.',
  },
  invalidation_rules: {
    label: 'Invalidation',
    help: 'What tells you the idea is wrong and you stand down.',
  },
  stop_loss_rules: {
    label: 'Stop loss',
    help: 'Where protection goes and how it is placed.',
  },
  take_profit_rules: {
    label: 'Profit target',
    help: 'How you decide where to take profit.',
  },
  position_sizing_rules: {
    label: 'Position sizing',
    help: 'How size is decided for this playbook.',
  },
  risk_rules: {
    label: 'Risk',
    help: 'Limits you hold yourself to — per trade, per day, per week.',
  },
  exit_rules: {
    label: 'Exit & trade management',
    help: 'How the position is managed and closed once it is live.',
  },
};

/** Builder/detail section order — the sequence a trader reasons in. */
export const RULE_GROUP_ORDER: RuleGroup[] = [
  'entry_rules',
  'confirmation_rules',
  'invalidation_rules',
  'stop_loss_rules',
  'take_profit_rules',
  'position_sizing_rules',
  'risk_rules',
  'exit_rules',
];

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};
