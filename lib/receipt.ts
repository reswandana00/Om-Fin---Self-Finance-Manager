import { normalizeSpendingCategory } from "@/lib/categories";
import { extractionPrompt } from "@/lib/ai-prompts";
import { requestGithubModel } from "@/lib/github-models";

export type ReceiptItem = {
	name: string;
	category: string;
	amount: number;
};

export type ReceiptScanResult = {
	transaction: string;
	items: ReceiptItem[];
};

export function calculateReceiptTotal(items: ReceiptItem[]) {
	return items.reduce((total, item) => total + item.amount, 0);
}

async function requestReceipt(body: Record<string, unknown>, source: string) {
	const response = await requestGithubModel(body);
	const content = response.choices?.[0]?.message?.content;
	if (!content) throw new Error("AI tidak mengembalikan hasil");
	console.log(`[AI raw output] ${source}`, content);
	const result = normalizeReceiptResult(JSON.parse(content) as ReceiptScanResult);
	console.log(`[AI confirmation draft] ${source}`, result);
	return result;
}

function normalizeReceiptResult(value: ReceiptScanResult): ReceiptScanResult {
	return {
		transaction: value.transaction?.trim() || "Transaksi",
		items: Array.isArray(value.items)
			? value.items.map((item) => ({
					name: String(item.name ?? "").trim(),
					category: normalizeSpendingCategory(String(item.category ?? "")),
					amount: Number(item.amount) || 0,
				}))
			: [],
	};
}

export async function scanReceiptImage(imageDataUrl: string) {
	if (!imageDataUrl.startsWith("data:image/")) throw new Error("Gambar tidak valid");
	return requestReceipt(
		{
			model: "openai/gpt-4o-mini",
			temperature: 0,
			max_tokens: 2400,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: extractionPrompt },
				{
					role: "user",
					content: [
						{ type: "text", text: "Ekstrak semua transaksi dari gambar ini." },
						{ type: "image_url", image_url: { url: imageDataUrl } },
					],
				},
			],
		},
		"camera",
	);
}

export async function parseTransactionText(text: string) {
	return requestReceipt(
		{
			model: "openai/gpt-4.1-nano",
			temperature: 0,
			top_p: 1,
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: extractionPrompt },
				{ role: "user", content: text.trim() },
			],
		},
		"text",
	);
}
