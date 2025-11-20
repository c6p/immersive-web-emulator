/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable sort-imports */
import { DevUI } from '@iwer/devui';
import { SyntheticEnvironmentModule } from '@iwer/sem';
import sceneJson from '@iwer/sem/captures/living_room.json';
import { XRDevice, metaQuest3 } from 'iwer';
import { HandTrackingManager } from './HandTrackingManager';
/* eslint-enable sort-imports */

export const injectRuntime = () => {
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	window.CustomWebXRPolyfill = true;
	const xrDevice = new XRDevice(metaQuest3);
	xrDevice.installRuntime();
	xrDevice.installDevUI(DevUI);
	xrDevice.installSEM(SyntheticEnvironmentModule);
	xrDevice.sem?.loadEnvironment(sceneJson);

	// Initialize hand tracking manager
	const handTrackingManager = new HandTrackingManager(xrDevice);

	// Expose hand tracking manager to window for easy access
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	window.handTrackingManager = handTrackingManager;

	// Add keyboard shortcut to toggle hand tracking (Ctrl+H)
	document.addEventListener('keydown', async (event) => {
		if (event.ctrlKey && event.key === 'h') {
			event.preventDefault();
			try {
				if (handTrackingManager.isActive()) {
					handTrackingManager.stopTracking();
					console.log('[IWE] Hand tracking disabled');
				} else {
					await handTrackingManager.startTracking();
					console.log('[IWE] Hand tracking enabled');
				}
			} catch (error) {
				console.error('[IWE] Failed to toggle hand tracking:', error);
			}
		}
	});

	console.log('[IWE] Hand tracking available. Press Ctrl+H to toggle.');
};
