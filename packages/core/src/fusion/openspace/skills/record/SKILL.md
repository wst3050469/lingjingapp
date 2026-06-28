# OpenSpace Record Skill

## Metadata
- **Name**: openspace-record
- **Version**: 1.0.0
- **Category**: openspace
- **Risk Level**: low
- **Author**: LingJing Fusion Team

## Description
Controls the OpenSpace recording/screenshot functionality. Supports starting/stopping frame recordings, capturing screenshots, and managing recording profiles.

## Parameters
| Name | Type | Required | Description |
|------|------|----------|-------------|
| action | string | yes | Action: 'start', 'stop', 'screenshot', 'status' |
| output_path | string | no | Output file path for recordings/screenshots |
| fps | number | no | Frames per second for recording (default: 30) |
| format | string | no | Output format: 'png', 'mp4', 'frames' |

## Usage Example
```
record(action="start", fps=60, format="mp4")
record(action="screenshot", output_path="/captures/scene.png")
record(action="stop")
```

## Security
- Filesystem write access required (output_path)
- No network access required
- Requires user confirmation for first-time write access
