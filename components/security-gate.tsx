"use client";

import { useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import { getPinHash, getProfile } from "@/lib/database";
import { UNLOCKED_SESSION_KEY, verifyPin } from "@/lib/security";
import { useKeyboardSafe } from "@/hooks/use-keyboard-safe";

export function SecurityGate({ children }: { children: React.ReactNode }) {
	useKeyboardSafe();
	const [checking, setChecking] = useState(true);
	const [locked, setLocked] = useState(false);
	const [pin, setPin] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		async function checkSecurity() {
		const profile = await getProfile();
		const unlocked = sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "true";

		const hasPin = Boolean(await getPinHash());
		setLocked(profile.biometric && hasPin && !unlocked);
		setChecking(false);
		}
		checkSecurity();
	}, []);

	async function unlock(pinValue = pin) {
		if (await verifyPin(pinValue)) {
			sessionStorage.setItem(UNLOCKED_SESSION_KEY, "true");
			setLocked(false);
			setError("");
			return;
		}
		setError("Incorrect PIN");
		setPin("");
	}

	if (checking) {
		return <div className="min-h-dvh bg-[#F8F9F7] dark:bg-background" />;
	}

	if (locked) {
		return (
			<main className="flex min-h-dvh items-center justify-center bg-[#F8F9F7] p-5 dark:bg-background">
				<div className="flex w-full max-w-sm flex-col items-center text-center">
					<div className="flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20">
						<LockKeyhole className="size-7" />
					</div>
					<h1 className="mt-6 text-2xl font-semibold tracking-tight">Enter your PIN</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Unlock My Finances to continue
					</p>
					<InputOTP
						containerClassName="mt-8"
						maxLength={6}
						value={pin}
						onChange={setPin}
						onComplete={(value) => unlock(value)}
						inputMode="numeric"
						pattern="[0-9]*"
						autoFocus
					>
						<InputOTPGroup>
							{Array.from({ length: 6 }).map((_, index) => (
								<InputOTPSlot index={index} key={index} />
							))}
						</InputOTPGroup>
					</InputOTP>
					{error && <p className="mt-3 text-xs text-red-500">{error}</p>}
					<Button className="mt-6 w-full rounded-full text-white" onClick={() => unlock()} disabled={pin.length !== 6}>
						Unlock
					</Button>
				</div>
			</main>
		);
	}

	return children;
}
