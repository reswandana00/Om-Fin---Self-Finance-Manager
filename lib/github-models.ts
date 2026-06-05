import { CapacitorHttp } from "@capacitor/core";

const endpoint = "https://models.github.ai/inference/chat/completions";
const tokenKey = "github-models-token";
let rateLimitedUntil = 0;

export class GithubModelsRateLimitError extends Error {
	constructor(public readonly retryAfterSeconds: number) {
		super(
			`Batas penggunaan GitHub Models tercapai. Coba lagi dalam ${formatWaitTime(retryAfterSeconds)}.`,
		);
		this.name = "GithubModelsRateLimitError";
	}
}

export function getStoredGithubToken() {
	return localStorage.getItem(tokenKey)?.trim() ?? "";
}

export function storeGithubToken(token: string) {
	const normalized = token.trim();
	if (normalized.length < 20) throw new Error("GitHub token tidak valid");
	localStorage.setItem(tokenKey, normalized);
	return normalized;
}

export function maskGithubToken(token: string) {
	const visibleLength = Math.max(1, Math.ceil(token.length * 0.2));
	return `${token.slice(0, visibleLength)}${"*".repeat(token.length - visibleLength)}`;
}

export async function requestGithubModel(body: Record<string, unknown>) {
	const token = getStoredGithubToken();
	if (!token) throw new Error("GitHub token belum dikonfigurasi di Profile");
	const cooldownSeconds = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
	if (cooldownSeconds > 0) throw new GithubModelsRateLimitError(cooldownSeconds);

	const response = await CapacitorHttp.post({
		url: endpoint,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		data: body,
		connectTimeout: 30_000,
		readTimeout: 120_000,
	});

	if (response.status < 200 || response.status >= 300) {
		if (response.status === 429) {
			const retryAfter = getHeader(response.headers, "retry-after");
			const retryAfterSeconds = Math.max(Number(retryAfter) || 60, 1);
			rateLimitedUntil = Date.now() + retryAfterSeconds * 1000;
			throw new GithubModelsRateLimitError(retryAfterSeconds);
		}
		const message =
			response.data?.error?.message ??
			response.data?.error ??
			`GitHub Models request gagal (${response.status})`;
		throw new Error(String(message));
	}
	return response.data as {
		choices?: Array<{
			message?: {
				role: "assistant";
				content: string | null;
				tool_calls?: Array<{
					id: string;
					type: "function";
					function: { name: string; arguments: string };
				}>;
			};
		}>;
	};
}

function getHeader(headers: Record<string, string> | undefined, name: string) {
	if (!headers) return "";
	const entry = Object.entries(headers).find(
		([key]) => key.toLowerCase() === name.toLowerCase(),
	);
	return entry?.[1] ?? "";
}

function formatWaitTime(seconds: number) {
	if (!Number.isFinite(seconds) || seconds <= 0) return "beberapa saat";
	if (seconds < 60) return `${Math.ceil(seconds)} detik`;
	return `${Math.ceil(seconds / 60)} menit`;
}
