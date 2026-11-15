import type { LevelDefinition, Requirement, RuleAction } from '../api/types';
export interface RuleContext {
  level: LevelDefinition;
  flags: Record<string, boolean>;
  collected: string[];
}
export interface RuleEffects {
  setFlag: (name: string, value: boolean) => void;
  complete: () => void;
}
export class RuleSystem {
  private conditions = new Map<string, (context: RuleContext) => boolean>();
  private actions = new Map<
    string,
    (action: RuleAction, context: RuleContext, effects: RuleEffects) => void
  >();
  constructor() {
    this.registerAction('setFlag', (a, _c, e) =>
      e.setFlag(a.flag!, a.value ?? true),
    );
    this.registerAction('toggleFlag', (a, c, e) =>
      e.setFlag(a.flag!, !c.flags[a.flag!]),
    );
    this.registerAction('completeLevel', (_a, _c, e) => e.complete());
  }
  registerCondition(name: string, handler: (context: RuleContext) => boolean) {
    if (this.conditions.has(name))
      throw new Error(`Warunek już istnieje: ${name}`);
    this.conditions.set(name, handler);
  }
  registerAction(
    name: string,
    handler: (
      action: RuleAction,
      context: RuleContext,
      effects: RuleEffects,
    ) => void,
  ) {
    if (this.actions.has(name)) throw new Error(`Akcja już istnieje: ${name}`);
    this.actions.set(name, handler);
  }
  validateRequirement(requirement?: Requirement) {
    if (requirement?.condition && !this.conditions.has(requirement.condition))
      throw new Error(`Nieznany warunek: ${requirement.condition}`);
  }
  validateAction(action: RuleAction) {
    if (!this.actions.has(action.action))
      throw new Error(`Nieznana akcja: ${action.action}`);
    if (
      ['setFlag', 'toggleFlag'].includes(action.action) &&
      (!action.flag || typeof action.flag !== 'string')
    )
      throw new Error('Akcja wymaga flagi');
  }
  allows(requirement: Requirement | undefined, context: RuleContext) {
    this.validateRequirement(requirement);
    return (
      (requirement?.allFlags ?? []).every((flag) => context.flags[flag]) &&
      (!requirement?.condition ||
        this.conditions.get(requirement.condition)!(context))
    );
  }
  run(actions: RuleAction[], context: RuleContext, effects: RuleEffects) {
    actions.forEach((action) => this.validateAction(action));
    actions.forEach((action) =>
      this.actions.get(action.action)!(action, context, effects),
    );
  }
}
