"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_TEMPLATES = void 0;
exports.matchTemplate = matchTemplate;
exports.fillTemplate = fillTemplate;
exports.BUILTIN_TEMPLATES = [
    {
        name: 'navigate_to_body',
        category: 'navigation',
        description: 'Navigate camera to a celestial body by name',
        keywords: ['navigate', 'fly', 'go', 'travel', 'body', 'planet', 'star', 'moon', 'target'],
        scriptTemplate: 'openspace.setPropertyValue("NavigationHandler.Target", "${target}")\nopenspace.setPropertyValue("NavigationHandler.FlyToTarget", true)',
        highRisk: false,
        language: 'lua',
    },
    {
        name: 'set_camera_distance',
        category: 'navigation',
        description: 'Set camera distance from current target',
        keywords: ['distance', 'zoom', 'camera', 'far', 'close', 'near', 'away'],
        scriptTemplate: 'openspace.setPropertyValue("NavigationHandler.Distance", ${distance})',
        highRisk: false,
        language: 'lua',
    },
    {
        name: 'set_time',
        category: 'time',
        description: 'Set simulation time to a specific date',
        keywords: ['time', 'date', 'when', 'year', 'epoch', 'simulation', 'set time'],
        scriptTemplate: 'openspace.time.setTime("${date}")',
        highRisk: false,
        language: 'lua',
    },
    {
        name: 'toggle_layer',
        category: 'scene',
        description: 'Toggle visibility of a scene graph layer',
        keywords: ['toggle', 'show', 'hide', 'layer', 'visibility', 'display', 'enable', 'disable'],
        scriptTemplate: 'local current = openspace.getPropertyValue("${property}")\nopenspace.setPropertyValue("${property}", not current)',
        highRisk: false,
        language: 'lua',
    },
    {
        name: 'start_recording',
        category: 'recording',
        description: 'Start frame recording with specified parameters',
        keywords: ['record', 'start', 'capture', 'frames', 'video', 'screenshot'],
        scriptTemplate: 'openspace.setPropertyValue("FrameExport.Enabled", true)\nopenspace.setPropertyValue("FrameExport.Framerate", ${fps})\nopenspace.setPropertyValue("FrameExport.Resolution.X", ${resolutionX})\nopenspace.setPropertyValue("FrameExport.Resolution.Y", ${resolutionY})',
        highRisk: true,
        language: 'lua',
    },
    {
        name: 'stop_recording',
        category: 'recording',
        description: 'Stop frame recording',
        keywords: ['stop', 'end', 'finish', 'recording', 'halt'],
        scriptTemplate: 'openspace.setPropertyValue("FrameExport.Enabled", false)',
        highRisk: false,
        language: 'lua',
    },
    {
        name: 'load_dataset',
        category: 'dataset',
        description: 'Load a dataset into the scene',
        keywords: ['load', 'add', 'dataset', 'data', 'import', 'scene', 'include'],
        scriptTemplate: 'openspace.addSceneGraphNode("${node}")',
        highRisk: true,
        language: 'lua',
    },
    {
        name: 'unload_dataset',
        category: 'dataset',
        description: 'Unload a dataset from the scene',
        keywords: ['unload', 'remove', 'delete', 'dataset', 'data', 'exclude', 'clear'],
        scriptTemplate: 'openspace.removeSceneGraphNode("${node}")',
        highRisk: true,
        language: 'lua',
    },
];
function matchTemplate(input) {
    const normalized = input.toLowerCase().trim();
    const inputWords = normalized.split(/\s+/);
    let bestMatch = null;
    let bestScore = 0;
    for (const template of exports.BUILTIN_TEMPLATES) {
        let score = 0;
        for (const word of inputWords) {
            for (const keyword of template.keywords) {
                if (word === keyword) {
                    score += 3;
                }
                else if (word.includes(keyword) || keyword.includes(word)) {
                    score += 1;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = template;
        }
    }
    if (bestScore < 2)
        return null;
    return bestMatch;
}
function fillTemplate(template, params) {
    let script = template.scriptTemplate;
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `\${${key}}`;
        script = script.replaceAll(placeholder, String(value));
    }
    return script;
}
//# sourceMappingURL=script-templates.js.map