"use client";

import { useEffect } from "react";

export function useKeyboardSafe() {
	useEffect(() => {
		function revealInput(event: FocusEvent) {
			const target = event.target;
			if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
				return;
			}

			window.setTimeout(() => {
				target.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 250);
		}

		document.addEventListener("focusin", revealInput);
		return () => document.removeEventListener("focusin", revealInput);
	}, []);
}
