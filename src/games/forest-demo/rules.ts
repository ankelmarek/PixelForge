import type { RuleSystem } from '../../engine/api';
// Trusted TS extension: names in JSON refer only to conditions registered here.
export function registerForestRules(rules: RuleSystem) {
  rules.registerCondition('allCollected', ({ level, collected }) =>
    (level.entities ?? [])
      .filter((entity) => entity.type === 'collectible')
      .every((entity) => collected.includes(entity.id)),
  );
}
