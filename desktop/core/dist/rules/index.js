// Stub: rules module
function loadAllRules() { return []; }
function applyRules(prompt, rules) { return prompt; }
function getManualRules() { return []; }
class RuleMerger {
  merge(userRules, projectRules) { return { merged: [], conflicts: [] }; }
}
export { loadAllRules, applyRules, getManualRules, RuleMerger };
