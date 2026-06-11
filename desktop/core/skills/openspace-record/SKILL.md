# OpenSpace Record

## Description
Record and replay OpenSpace sessions. Capture camera movements, scene changes, and time manipulations for presentation or review purposes.

## Trigger
When the user asks to start/stop recording or play back a recorded session in OpenSpace.

## Actions
1. For recording: Start frame capture with timestamp metadata
2. For playback: Load recording and replay frames at captured cadence
3. Manage recording lifecycle (start, stop, save, delete, list)

## Parameters
- `action` (required): One of "start", "stop", "play", "stopPlayback", "list", "delete"
- `recordingId` (for play/delete): ID of the target recording
- `name` (for start): Optional name for the recording

## Examples
- "Start recording"
- "Stop recording"
- "Play recording <id>"
- "List all recordings"

## Dependencies
- OpenSpace application running and connected
- WebSocket bridge active
- Sufficient disk space for recording storage
