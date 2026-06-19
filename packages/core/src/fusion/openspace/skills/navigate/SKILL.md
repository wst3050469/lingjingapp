# OpenSpace Navigate Skill

## Metadata
- **Name**: openspace-navigate
- **Version**: 1.0.0
- **Category**: openspace
- **Risk Level**: low
- **Author**: LingJing Fusion Team

## Description
Navigates the OpenSpace camera to a specified celestial body or coordinates. Supports solar system bodies, deep sky objects, and custom RA/Dec coordinates.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| target | string | yes | Target body name or catalog identifier |
| duration | number | no | Transition duration in seconds (default: 3) |
| coordinate_system | string | no | Coordinate system: 'ecliptic', 'equatorial', 'galactic' |

## Usage Example
```
navigate(target="Earth", duration=5)
navigate(target="Mars", coordinate_system="ecliptic")
```

## Security
- No filesystem access required
- No network access required
- Safe for auto-execution
