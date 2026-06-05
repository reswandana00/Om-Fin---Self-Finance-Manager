export const UNLOCKED_SESSION_KEY = "self-finance-unlocked";

import { getPinHash } from "@/lib/database";

export async function hashPin(pin: string) {
	const bytes = new TextEncoder().encode(pin);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function verifyPin(pin: string) {
	const savedHash = await getPinHash();
	return Boolean(savedHash && (await hashPin(pin)) === savedHash);
}
