import {
	getFinancialOverview,
	getTransactions,
} from "@/lib/database";
import { analysisPrompt } from "@/lib/ai-prompts";
import {
	GithubModelsRateLimitError,
	requestGithubModel,
} from "@/lib/github-models";

export async function askAnalysisAi(question: string) {
	const [overview, transactions] = await Promise.all([
		getFinancialOverview(),
		getTransactions(),
	]);
	const recentTransactions = transactions.slice(0, 30).map((transaction) => ({
		name: transaction.name,
		category: transaction.category,
		amount: transaction.amount,
		date: transaction.occurred_at.slice(0, 10),
	}));

	try {
		const response = await requestGithubModel({
			model: "openai/gpt-4.1-nano",
			temperature: 0.4,
			top_p: 1,
			max_tokens: 700,
			messages: [
				{ role: "system", content: analysisPrompt },
				{
					role: "user",
					content: `Data keuangan:
${JSON.stringify({
	balance: overview.balance,
	income: overview.income,
	expense: overview.expense,
	openingBalance: overview.budget,
	spendingProgress: overview.progress,
	recentTransactions,
})}

Pertanyaan: ${question.trim()}`,
				},
			],
		});

		const content = response.choices?.[0]?.message?.content;
		if (!content) throw new Error("Analysis AI tidak mengembalikan jawaban");
		return content;
	} catch (error) {
		if (!(error instanceof GithubModelsRateLimitError)) throw error;
		return buildLocalFallback(overview, recentTransactions, error.message);
	}
}

function buildLocalFallback(
	overview: Awaited<ReturnType<typeof getFinancialOverview>>,
	transactions: Array<{ category: string; amount: number }>,
	rateLimitMessage: string,
) {
	const categoryTotals = new Map<string, number>();
	for (const transaction of transactions) {
		if (transaction.amount >= 0) continue;
		categoryTotals.set(
			transaction.category,
			(categoryTotals.get(transaction.category) ?? 0) + Math.abs(transaction.amount),
		);
	}
	const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
	const remaining =
		overview.income !== null && overview.expense !== null
			? overview.income - overview.expense
			: null;

	return `### Analisis lokal

${rateLimitMessage} Sementara itu, berikut analisis dari data di perangkat:

- Saldo tercatat: **${formatRupiah(overview.balance)}**
- Total pemasukan dikurangi pengeluaran: **${remaining === null ? "-" : formatRupiah(remaining)}**
- Kategori pengeluaran terbesar dari transaksi terbaru: **${topCategory ? `${topCategory[0]} (${formatRupiah(topCategory[1])})` : "-"}**

Batasi pengeluaran pada kategori terbesar dan cek kembali setelah kuota GitHub Models tersedia.`;
}

function formatRupiah(value: number | null) {
	if (value === null) return "-";
	return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}
