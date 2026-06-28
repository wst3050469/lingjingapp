# OpenSpace Scene Skill

## Metadata
- **Name**: openspace-scene
- **Version**: 1.0.0
- **Category**: openspace
- **Risk Level**: low
- **Author**: LingJing Fusion Team

## Description
Loads a predefined or custom scene configuration in OpenSpace. A scene defines the complete visualization state including camera position, time, visible layers, and render settings.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| scene_name | string | yes | Name of the scene to load |
| blend_duration | number | no | Scene transition blend time in seconds (default: 2) |
| preserve_camera | boolean | no | Keep current camera position (default: false) |

## Usage Example
```
scene(scene_name="solar_system_overview")
scene(scene_name="earth_orbit", blend_duration=4)
```

## Security
- No filesystem access required
- No network access required
- Safe for auto-execution
