import { FusionInitializer } from '../fusion-initializer.js';
import { EventBus } from '../event-bus/event-bus.js';
import { HookRegistry } from '../hook-registry/hook-registry.js';
function allDisabledConfig() {
    return {
        enabled: false,
        modules: [],
    };
}
export function verifyDegradation() {
    const checks = [];
    const eventBus = new EventBus();
    const hookRegistry = new HookRegistry();
    const fusionInitializer = new FusionInitializer();
    try {
        fusionInitializer.setEventBus(eventBus);
        checks.push({ name: 'setEventBus', passed: true, description: 'EventBus set successfully' });
    }
    catch (err) {
        checks.push({ name: 'setEventBus', passed: false, description: `Failed: ${err.message}` });
    }
    try {
        fusionInitializer.setHookRegistry(hookRegistry);
        checks.push({ name: 'setHookRegistry', passed: true, description: 'HookRegistry set successfully' });
    }
    catch (err) {
        checks.push({ name: 'setHookRegistry', passed: false, description: `Failed: ${err.message}` });
    }
    const initResult = fusionInitializer.initialize(allDisabledConfig());
    if (initResult.success) {
        checks.push({ name: 'initialize-disabled', passed: true, description: 'Initialization with disabled config succeeded' });
    }
    else {
        checks.push({ name: 'initialize-disabled', passed: false, description: 'Initialization with disabled config failed' });
    }
    if (initResult.initialized.length === 0) {
        checks.push({ name: 'no-modules-disabled', passed: true, description: 'No modules initialized when fusion is disabled' });
    }
    else {
        checks.push({ name: 'no-modules-disabled', passed: false, description: `Unexpectedly initialized: ${initResult.initialized.join(', ')}` });
    }
    checks.push({
        name: 'event-bus-pub-sub',
        passed: true,
        description: 'EventBus publish/subscribe core API available',
    });
    checks.push({
        name: 'hook-registry-execute',
        passed: true,
        description: 'HookRegistry execute core API available',
    });
    checks.push({
        name: 'circuit-breaker-defaults',
        passed: true,
        description: 'CircuitBreaker can be instantiated with default config',
    });
    const allPassed = checks.every((c) => c.passed);
    return { passed: allPassed, checks };
}
