// Stub: planning module
let _planManager = null;
export function getPlanManager() {
  if (!_planManager) {
    _planManager = {
      getPlan() { return null; },
      savePlan() {},
      listPlans() { return []; },
    };
  }
  return _planManager;
}
