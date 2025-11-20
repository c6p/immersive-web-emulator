# Hand Tracking with MediaPipe

The Immersive Web Emulator now supports hand tracking using MediaPipe Hands, allowing you to control virtual hands using your real hands captured by your webcam.

## Features

- Real-time hand tracking using MediaPipe Hands library
- Support for both left and right hands simultaneously
- Automatic mapping of 21 hand landmarks to WebXR hand joints
- Pinch gesture detection
- Seamless switching between controller and hand input modes

## Usage

### Enabling Hand Tracking

1. Load a WebXR application that supports hand tracking
2. Press **Ctrl+H** to enable hand tracking
3. Grant camera permissions when prompted
4. Your hands will now control the virtual hands in the XR scene

### Disabling Hand Tracking

Press **Ctrl+H** again to disable hand tracking and return to controller mode.

### Programmatic Access

The hand tracking manager is exposed globally for programmatic control:

```javascript
// Check if hand tracking is active
if (window.handTrackingManager.isActive()) {
  console.log('Hand tracking is enabled');
}

// Start hand tracking programmatically
await window.handTrackingManager.startTracking();

// Stop hand tracking programmatically
window.handTrackingManager.stopTracking();
```

## Technical Details

### Hand Landmark Mapping

MediaPipe Hands provides 21 landmarks per hand which are mapped to WebXR hand joints:

- **Wrist** (1 landmark)
- **Thumb** (4 landmarks: metacarpal, proximal, distal, tip)
- **Index finger** (5 landmarks: metacarpal, proximal, intermediate, distal, tip)
- **Middle finger** (5 landmarks: metacarpal, proximal, intermediate, distal, tip)
- **Ring finger** (5 landmarks: metacarpal, proximal, intermediate, distal, tip)
- **Pinky finger** (5 landmarks: metacarpal, proximal, intermediate, distal, tip)

### Gesture Detection

The system automatically detects pinch gestures by measuring the distance between the thumb tip and index finger tip. This value is used to:
- Trigger select events in WebXR applications
- Interpolate between relaxed and pinch hand poses
- Provide analog pinch values for fine control

### Coordinate System Transformation

MediaPipe provides normalized 3D coordinates (0-1 range) in camera space. The system transforms these to WebXR world space by:
1. Scaling to appropriate hand size (~15cm)
2. Reorienting from camera space to XR space
3. Mirroring left hand coordinates for proper handedness
4. Computing joint rotations from bone directions

## Requirements

- Modern Chromium-based browser (Chrome, Edge, etc.)
- Webcam access
- Sufficient lighting for hand detection

## Limitations

- Hand tracking accuracy depends on lighting conditions
- Maximum of 2 hands tracked simultaneously
- Requires clear view of hands in camera frame
- May have higher latency than native XR hand tracking

## Troubleshooting

### Camera Access Issues

If the camera doesn't activate:
1. Check browser permissions for camera access
2. Ensure no other application is using the camera
3. Try refreshing the page and enabling hand tracking again

### Poor Tracking Quality

If hand tracking is unstable:
1. Improve lighting conditions
2. Ensure hands are clearly visible to the camera
3. Reduce background clutter
4. Keep hands within the camera frame

### Performance Issues

If experiencing low frame rates:
1. Close unnecessary browser tabs
2. Ensure your GPU drivers are up to date
3. Try reducing video resolution (implemented in future update)

## Privacy

Hand tracking is performed entirely locally in your browser. No camera data is transmitted to external servers. The camera feed is only used for real-time hand detection and is not recorded or stored.
