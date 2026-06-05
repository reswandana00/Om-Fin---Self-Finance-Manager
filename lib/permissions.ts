import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export async function requestNotificationPermission() {
	if (Capacitor.isNativePlatform()) {
		const current = await LocalNotifications.checkPermissions();
		if (current.display === "granted") return true;

		const requested = await LocalNotifications.requestPermissions();
		return requested.display === "granted";
	}

	if (!("Notification" in window)) return false;
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;

	return (await Notification.requestPermission()) === "granted";
}

export function getMediaPermissionError(
	error: unknown,
	device: "camera" | "microphone",
) {
	if (error instanceof DOMException) {
		if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
			return `${capitalize(device)} permission was denied. Enable it in the app settings.`;
		}
		if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
			return `No ${device} was found on this device.`;
		}
	}

	return `${capitalize(device)} access is unavailable.`;
}

function capitalize(value: string) {
	return value.charAt(0).toUpperCase() + value.slice(1);
}
