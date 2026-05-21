# OpenSpace Navigate

## Description
Navigate to celestial targets in the OpenSpace universe. Fly to planets, moons, and other celestial bodies with smooth camera transitions.

## Trigger
When the user asks to navigate to, fly to, or go to a celestial target in OpenSpace.

## Actions
1. Validate the target name against the known celestial body catalog
2. Send a `openspace:flyToTarget` command via WebSocket bridge
3. Wait for camera transition completion
4. Report arrival at target with current position data

## Parameters
- `target` (required): Name of the celestial body (e.g., "Mars", "Jupiter", "Saturn")
- `duration` (optional): Transition duration in seconds (default: 5)

## Examples
- "Fly to Mars"
- "Navigate to Jupiter"
- "Go to the Moon"

## Dependencies
- OpenSpace application running and connected
- WebSocket bridge active
