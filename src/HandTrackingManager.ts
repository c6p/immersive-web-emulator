/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
	FilesetResolver,
	HandLandmarker,
	NormalizedLandmark,
} from '@mediapipe/tasks-vision';
import { mat4, quat, vec3 } from 'gl-matrix';
import { XRDevice } from 'iwer';

/**
 * WebXR hand joint names
 */
type XRHandJoint = string;

/**
 * Maps MediaPipe hand landmark indices to WebXR hand joints.
 * MediaPipe provides 21 landmarks per hand:
 * 0: WRIST
 * 1-4: THUMB (CMC, MCP, IP, TIP)
 * 5-8: INDEX (MCP, PIP, DIP, TIP)
 * 9-12: MIDDLE (MCP, PIP, DIP, TIP)
 * 13-16: RING (MCP, PIP, DIP, TIP)
 * 17-20: PINKY (MCP, PIP, DIP, TIP)
 */
const MEDIAPIPE_TO_WEBXR_JOINT_MAP: { [key: number]: XRHandJoint } = {
	0: 'wrist',
	1: 'thumb-metacarpal',
	2: 'thumb-phalanx-proximal',
	3: 'thumb-phalanx-distal',
	4: 'thumb-tip',
	5: 'index-finger-metacarpal',
	6: 'index-finger-phalanx-proximal',
	7: 'index-finger-phalanx-intermediate',
	8: 'index-finger-phalanx-distal',
	9: 'index-finger-tip',
	10: 'middle-finger-metacarpal',
	11: 'middle-finger-phalanx-proximal',
	12: 'middle-finger-phalanx-intermediate',
	13: 'middle-finger-phalanx-distal',
	14: 'middle-finger-tip',
	15: 'ring-finger-metacarpal',
	16: 'ring-finger-phalanx-proximal',
	17: 'ring-finger-phalanx-intermediate',
	18: 'ring-finger-phalanx-distal',
	19: 'ring-finger-tip',
	20: 'pinky-finger-metacarpal',
	21: 'pinky-finger-phalanx-proximal',
	22: 'pinky-finger-phalanx-intermediate',
	23: 'pinky-finger-phalanx-distal',
	24: 'pinky-finger-tip',
};

export class HandTrackingManager {
	private xrDevice: XRDevice;

	private handLandmarker: HandLandmarker | null = null;

	private videoElement: HTMLVideoElement | null = null;

	private stream: MediaStream | null = null;

	private animationFrameId: number | null = null;

	private isInitialized = false;

	private isTracking = false;

	constructor(xrDevice: XRDevice) {
		this.xrDevice = xrDevice;
	}

	/**
	 * Initialize MediaPipe HandLandmarker and setup camera access
	 */
	async initialize(): Promise<void> {
		if (this.isInitialized) {
			return;
		}

		try {
			// Initialize MediaPipe vision tasks
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
			);

			// Create HandLandmarker
			this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath:
						'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
					delegate: 'GPU',
				},
				numHands: 2,
				runningMode: 'VIDEO',
				minHandDetectionConfidence: 0.5,
				minHandPresenceConfidence: 0.5,
				minTrackingConfidence: 0.5,
			});

			this.isInitialized = true;
			console.log('[HandTracking] MediaPipe HandLandmarker initialized');
		} catch (error) {
			console.error('[HandTracking] Failed to initialize:', error);
			throw error;
		}
	}

	/**
	 * Start hand tracking from camera feed
	 */
	async startTracking(): Promise<void> {
		if (!this.isInitialized) {
			await this.initialize();
		}

		if (this.isTracking) {
			return;
		}

		try {
			// Request camera access
			this.stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'user',
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
			});

			// Create video element to capture camera feed
			this.videoElement = document.createElement('video');
			this.videoElement.srcObject = this.stream;
			this.videoElement.autoplay = true;
			this.videoElement.playsInline = true;

			// Wait for video to be ready
			await new Promise<void>((resolve) => {
				if (this.videoElement) {
					this.videoElement.onloadedmetadata = () => {
						this.videoElement?.play();
						resolve();
					};
				}
			});

			// Switch to hand input mode
			this.xrDevice.primaryInputMode = 'hand';

			this.isTracking = true;
			this.processVideoFrame();
			console.log('[HandTracking] Started tracking');
		} catch (error) {
			console.error('[HandTracking] Failed to start tracking:', error);
			throw error;
		}
	}

	/**
	 * Stop hand tracking and release camera
	 */
	stopTracking(): void {
		if (!this.isTracking) {
			return;
		}

		// Cancel animation frame
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		// Stop video stream
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop());
			this.stream = null;
		}

		// Remove video element
		if (this.videoElement) {
			this.videoElement.srcObject = null;
			this.videoElement = null;
		}

		// Switch back to controller mode
		this.xrDevice.primaryInputMode = 'controller';

		this.isTracking = false;
		console.log('[HandTracking] Stopped tracking');
	}

	/**
	 * Process video frames and update hand landmarks
	 */
	private processVideoFrame = (): void => {
		if (!this.isTracking || !this.videoElement || !this.handLandmarker) {
			return;
		}

		const timestamp = performance.now();
		const results = this.handLandmarker.detectForVideo(
			this.videoElement,
			timestamp,
		);

		if (results && results.landmarks && results.handedness) {
			this.updateHandPoses(results.landmarks, results.handedness);
		}

		// Schedule next frame
		this.animationFrameId = requestAnimationFrame(this.processVideoFrame);
	};

	/**
	 * Update XRDevice hand poses from MediaPipe landmarks
	 */
	private updateHandPoses(
		landmarks: NormalizedLandmark[][],
		handedness: { categoryName: string }[][],
	): void {
		const hands = this.xrDevice.hands;

		// Process each detected hand
		for (let i = 0; i < landmarks.length && i < handedness.length; i++) {
			const handLandmarks = landmarks[i];
			const handInfo = handedness[i][0];

			// Determine which hand (left or right)
			const isLeftHand = handInfo.categoryName.toLowerCase() === 'left';
			const hand = isLeftHand ? hands.left : hands.right;

			if (!hand) {
				continue;
			}

			// Calculate pinch value (distance between thumb tip and index tip)
			const thumbTip = handLandmarks[4];
			const indexTip = handLandmarks[8];
			const pinchDistance = Math.sqrt(
				Math.pow(thumbTip.x - indexTip.x, 2) +
					Math.pow(thumbTip.y - indexTip.y, 2) +
					Math.pow(thumbTip.z - indexTip.z, 2),
			);
			// Normalize pinch value (0 = pinched, 1 = open)
			const pinchValue = Math.max(0, Math.min(1, pinchDistance * 10));
			hand.updatePinchValue(1 - pinchValue);

			// Update hand pose based on landmarks
			this.updateHandJoints(hand, handLandmarks, isLeftHand);
		}
	}

	/**
	 * Update individual hand joints from MediaPipe landmarks
	 */
	private updateHandJoints(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		hand: any,
		landmarks: NormalizedLandmark[],
		isLeftHand: boolean,
	): void {
		// Get the wrist position as the reference point
		const wrist = landmarks[0];

		// Scale factor to convert normalized coordinates to world space
		// This is a rough approximation - you may need to adjust this
		const scale = 0.2;

		// Calculate transforms for each joint
		for (let i = 0; i < landmarks.length; i++) {
			const landmark = landmarks[i];
			const joint = MEDIAPIPE_TO_WEBXR_JOINT_MAP[i];

			if (!joint) {
				continue;
			}

			// Convert normalized coordinates to world space
			// MediaPipe uses camera-relative coordinates (0-1 range)
			// We need to transform these to the XR space
			const x = (landmark.x - wrist.x) * scale;
			const y = -(landmark.y - wrist.y) * scale; // Flip Y axis
			const z = -(landmark.z - wrist.z) * scale; // Flip Z axis

			// Mirror for left hand
			const finalX = isLeftHand ? -x : x;

			// Create position vector
			const position = vec3.fromValues(finalX, y, z);

			// Calculate orientation based on adjacent joints
			const rotation = this.calculateJointRotation(landmarks, i, isLeftHand);

			// Create transform matrix
			const matrix = mat4.create();
			mat4.fromRotationTranslation(matrix, rotation, position);

			// Update the joint transform
			// Note: The actual API for updating joints may differ
			// This is a simplified approach
			if (hand[Symbol.for('hand_input')]) {
				const handInput = hand[Symbol.for('hand_input')];
				if (handInput.poses && handInput.poses[handInput.poseId]) {
					const pose = handInput.poses[handInput.poseId];
					if (pose.jointTransforms && pose.jointTransforms[joint]) {
						pose.jointTransforms[joint].offsetMatrix = matrix;
						pose.jointTransforms[joint].radius = 0.01; // Default radius
					}
				}
			}
		}

		// Update the hand pose
		hand.updateHandPose();
	}

	/**
	 * Calculate joint rotation based on adjacent landmarks
	 */
	private calculateJointRotation(
		landmarks: NormalizedLandmark[],
		index: number,
		isLeftHand: boolean,
	): quat {
		// Simple approximation: calculate rotation from bone direction
		let nextIndex = index + 1;

		// For tip joints, use the previous joint
		if (
			index === 4 ||
			index === 8 ||
			index === 12 ||
			index === 16 ||
			index === 20
		) {
			nextIndex = index - 1;
		}

		// If we have a next joint, calculate direction
		if (nextIndex < landmarks.length) {
			const current = landmarks[index];
			const next = landmarks[nextIndex];

			const dx = next.x - current.x;
			const dy = next.y - current.y;
			const dz = next.z - current.z;

			// Normalize direction
			const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
			if (length > 0) {
				const dirX = (isLeftHand ? -dx : dx) / length;
				// const dirY = -dy / length; // Unused for now
				const dirZ = -dz / length;

				// Create a rotation quaternion from direction
				// This is simplified - a more accurate approach would use
				// multiple points to determine the full orientation
				const rotation = quat.create();
				const axis = vec3.fromValues(0, 1, 0); // Up axis
				const angle = Math.atan2(dirX, dirZ);
				quat.setAxisAngle(rotation, axis, angle);

				return rotation;
			}
		}

		// Default identity rotation
		return quat.create();
	}

	/**
	 * Check if hand tracking is currently active
	 */
	isActive(): boolean {
		return this.isTracking;
	}

	/**
	 * Cleanup resources
	 */
	dispose(): void {
		this.stopTracking();

		if (this.handLandmarker) {
			this.handLandmarker.close();
			this.handLandmarker = null;
		}

		this.isInitialized = false;
	}
}
