# OpenSpace Scene

## Description
Control the OpenSpace scene: toggle layers, adjust time, and manage visual properties of the 3D universe visualization.

## Trigger
When the user asks to control scene properties, toggle layers, adjust simulation time, or modify visual settings in OpenSpace.

## Actions
1. Parse the scene control command (layer toggle, time set, property change)
2. Validate the command against the OpenSpace API specification
3. Execute the command via WebSocket bridge
4. Report the result with current scene state

## Parameters
- `action` (required): One of "toggleLayer", "setTime", "setProperty", "addLayer", "removeLayer"
- `layer` (for toggleLayer): Layer name (e.g., "Stars", "MilkyWay", "Asterisms")
- `time` (for setTime): ISO datetime string
- `property` (for setProperty): Property path and value

## Examples
- "Toggle the Stars layer"
- "Set simulation time to 2024-06-01"
- "Show the Milky Way"

## Dependencies
- OpenSpace application running and connected
- WebSocket bridge active
