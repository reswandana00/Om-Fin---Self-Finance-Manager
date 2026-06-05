import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const endpoint = "https://models.github.ai/inference";
const visionModel = "openai/gpt-4o-mini";
const textModel = "openai/gpt-4.1-nano";
const audioModel = "openai/gpt-4.1";
const analysisModel = "deepseek/DeepSeek-V3-0324";
const port = Number(process.env.RECEIPT_AI_PORT ?? 8787);
const tokenFile = resolve(".data/github-models-token");
const categories = [
	"Pantry",
	"Laundry",
	"Lavatory",
	"Transport",
	"Bill",
	"Subscription",
	"Culinary",
	"Entertainment",
	"Else",
	"Unused",
];
const audioExtractionPrompt = `Ekstrak transaksi berbahasa Indonesia dari audio menjadi JSON saja:
{"transaction":"string","items":[{"name":"string","category":"string","amount":0}]}
Kategori wajib salah satu: Pantry, Laundry, Lavatory, Transport, Bill, Subscription, Culinary, Entertainment, Else, Unused.
Ubah rb/ribu/k menjadi x1000 dan juta menjadi x1000000. Amount wajib integer rupiah.
Jangan mengarang item atau nominal. Jika tidak ada item bernominal, kembalikan {"transaction":"Transaksi","items":[]}.`;
let activeToken = "";

await getToken();

const server = createServer(async (request, response) => {
	setCorsHeaders(response);
	if (request.method === "OPTIONS") {
		response.writeHead(204).end();
		return;
	}
	if (
		!["GET", "POST"].includes(request.method) ||
		![
			"/scan-receipt",
			"/parse-transaction",
			"/parse-transaction-audio",
			"/analysis",
			"/settings/github-token",
		].includes(request.url)
	) {
		sendJson(response, 404, { error: "Not found" });
		return;
	}

	try {
		if (request.url === "/settings/github-token") {
			if (request.method === "GET") {
				const token = await getToken();
				sendJson(response, 200, {
					configured: Boolean(token),
					maskedToken: token ? maskToken(token) : "",
				});
				return;
			}
			const body = await readJson(request);
			await saveToken(body.token);
			const token = await getToken();
			sendJson(response, 200, {
				configured: true,
				maskedToken: maskToken(token),
			});
			return;
		}
		if (request.method !== "POST") {
			sendJson(response, 405, { error: "Method not allowed" });
			return;
		}
		const body = await readJson(request);
		if (request.url === "/analysis") {
			sendJson(response, 200, {
				message: await analyzeFinances(body.messages),
			});
			return;
		}
		const content =
			request.url === "/scan-receipt"
				? await scanReceipt(body.image)
				: request.url === "/parse-transaction-audio"
					? await parseTransactionAudio(body.audio)
					: await parseTransaction(body.text);
		console.log(`[AI raw output] ${request.url}`, content);
		const result = validateResult(content ? JSON.parse(content) : null);
		console.log(`[AI validated output] ${request.url}`, JSON.stringify(result));
		sendJson(response, 200, result);
	} catch (error) {
		console.error(error);
		sendJson(response, 500, { error: error?.message ?? "AI request failed" });
	}
});

server.on("error", (error) => {
	if (error.code === "EADDRINUSE") {
		console.error(
			`AI proxy port ${port} is already in use. Stop the existing AI server before starting npm run dev so stale code is not reused.`,
		);
	}
	throw error;
});

server.listen(port, "0.0.0.0", () => {
	console.log(`Receipt AI proxy listening on http://localhost:${port}`);
});

async function scanReceipt(image) {
	if (typeof image !== "string" || !image.startsWith("data:image/")) {
		throw new Error("A receipt image data URL is required");
	}
	const completion = await getOpenAiClient().chat.completions.create({
		model: visionModel,
		temperature: 1,
		max_tokens: 2400,
		response_format: { type: "json_object" },
		messages: [
			{ role: "system", content: extractionPrompt("receipt") },
			{
				role: "user",
				content: [
					{ type: "text", text: "Extract the merchant and purchased items." },
					{ type: "image_url", image_url: { url: image } },
				],
			},
		],
	});
	return completion.choices[0]?.message.content;
}

async function parseTransaction(text) {
	if (typeof text !== "string" || !text.trim()) {
		throw new Error("Transaction text is required");
	}
	const response = await getModelClient()
		.path("/chat/completions")
		.post({
			body: {
				model: textModel,
				temperature: 1,
				top_p: 1,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content: extractionPrompt("transaction description"),
					},
					{ role: "user", content: text.trim() },
				],
			},
		});
	if (isUnexpected(response)) throw response.body.error;
	return response.body.choices[0]?.message.content;
}

async function parseTransactionAudio(audio) {
	if (typeof audio !== "string" || !audio.startsWith("data:audio/")) {
		throw new Error("Recorded audio data URL is required");
	}
	const parsedAudio = parseAudioDataUrl(audio);
	const response = await getModelClient()
		.path("/chat/completions")
		.post({
			body: {
				model: audioModel,
				temperature: 1,
				top_p: 1,
				response_format: { type: "json_object" },
				messages: [
					{ role: "system", content: audioExtractionPrompt },
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Understand this spoken transaction and extract the spending items.",
							},
							{
								type: "input_audio",
								input_audio: parsedAudio,
							},
						],
					},
				],
			},
		});
	if (isUnexpected(response)) throw response.body.error;
	return response.body.choices[0]?.message.content;
}

function parseAudioDataUrl(value) {
	const match = /^data:audio\/(wav|mpeg|mp3);base64,(.+)$/i.exec(value);
	if (!match) throw new Error("Recorded audio must be WAV or MP3");
	return {
		format: match[1].toLowerCase() === "mpeg" ? "mp3" : match[1].toLowerCase(),
		data: match[2],
	};
}

async function analyzeFinances(messages) {
	if (!Array.isArray(messages) || !messages.length) {
		throw new Error("Analysis messages are required");
	}
	const response = await getModelClient()
		.path("/chat/completions")
		.post({
			body: {
				model: analysisModel,
				temperature: 0.4,
				top_p: 1,
				max_tokens: 1000,
				messages: [
					{
						role: "system",
						content: `Kamu adalah chatbot analisis keuangan pribadi.

Tugas utama:
Menganalisis data transaksi pengguna dan memberikan insight yang sederhana, praktis, dan mudah dipahami. Fokus pada rekomendasi, alert, evaluasi kebiasaan belanja, budgeting, dan hal lain yang berhubungan dengan manajemen keuangan pribadi.

Tujuan:
- Membantu pengguna memahami pola pengeluaran.
- Memberikan alert jika ada pengeluaran tidak wajar.
- Memberikan rekomendasi hemat yang realistis.
- Membantu pengguna mengatur prioritas keuangan.
- Membantu pengguna membuat keputusan finansial harian yang lebih baik.

Gaya jawaban:
- Gunakan bahasa Indonesia.
- Jawaban singkat, jelas, dan langsung ke inti.
- Gunakan gaya natural seperti asisten finansial pribadi.
- Jangan terlalu formal.
- Jangan menghakimi pengguna.
- Gunakan angka, kategori, dan perbandingan jika tersedia.
- Tidak wajib menjawab dalam format JSON.

Aturan analisis:
- Gunakan tools get_balance dan get_transactions jika saldo atau data transaksi diperlukan.
- Gunakan hanya data transaksi yang diberikan pengguna atau didapatkan melalui tools.
- Jangan mengarang nominal, saldo, pemasukan, utang, atau target finansial.
- Jika data kurang lengkap, jelaskan keterbatasannya secara singkat.
- Bedakan antara fakta dari data dan saran/rekomendasi.
- Jangan memberikan nasihat investasi, pajak, hukum, atau keputusan finansial besar secara absolut.
- Untuk keputusan besar, sarankan pengguna mengecek ulang kondisi keuangan mereka.

Hal yang bisa diberikan:
- Ringkasan pengeluaran.
- Kategori pengeluaran terbesar.
- Alert pengeluaran boros atau tidak wajar.
- Rekomendasi penghematan.
- Saran budgeting.
- Deteksi subscription atau tagihan berulang.
- Perbandingan pengeluaran antar periode jika datanya tersedia.
- Rencana tindakan sederhana.
- Insight kebiasaan belanja.`,
					},
					...messages,
				],
				tools: [
					{
						type: "function",
						function: {
							name: "get_balance",
							description:
								"Get current balance, total recorded income, total recorded expense, monthly opening balance, and spending progress.",
							parameters: { type: "object", properties: {} },
						},
					},
					{
						type: "function",
						function: {
							name: "get_transactions",
							description:
								"Get recent transactions when transaction-level analysis is needed.",
							parameters: {
								type: "object",
								properties: {
									limit: {
										type: "integer",
										description:
											"Maximum recent transactions to return, up to 100.",
									},
								},
							},
						},
					},
				],
				tool_choice: "auto",
			},
		});
	if (isUnexpected(response)) throw response.body.error;
	return response.body.choices[0]?.message;
}

function extractionPrompt(source) {
	return `Kamu adalah extractor transaksi keuangan pribadi.

Ubah input pengguna berbahasa Indonesia dari sumber "${source}" menjadi JSON valid.

Tugas:
Ekstrak 1 nama transaksi utama dan semua item pengeluaran yang memiliki nominal.
Kembalikan hanya JSON valid. Jangan tambahkan penjelasan, markdown, komentar, atau teks lain.

Skema output wajib:
{"transaction":"string","items":[{"name":"string","category":"string","amount":0}]}

Definisi field:
- transaction: nama umum transaksi, merchant, tempat, sesi belanja, atau konteks pengeluaran.
- items: daftar item pengeluaran yang benar-benar disebutkan dan memiliki nominal.
- name: nama barang, jasa, tempat, aktivitas, atau tagihan.
- category: wajib salah satu dari:
  Pantry, Laundry, Lavatory, Transport, Bill, Subscription, Culinary, Entertainment, Else, Unused
- amount: integer rupiah, tanpa titik, koma, simbol Rp, atau teks tambahan.

Aturan transaction:
- Jika ada merchant/tempat, gunakan sebagai transaction.
  Contoh: "belanja indomaret beli roti 10rb" => "Belanja Indomaret"
- Jika ada konteks seperti belanja, jajan, makan, transport, tagihan, gunakan konteks itu.
  Contoh: "makan nasi goreng 12rb" => "Makan"
- Jika tidak ada konteks jelas, gunakan "Transaksi".
- Gunakan Title Case.
- Jangan masukkan nominal ke transaction.
- Jangan masukkan daftar item ke transaction.
- Transaction maksimal 4 kata jika memungkinkan.

Aturan items:
- Ekstrak semua item yang memiliki nominal.
- Jangan masukkan item tanpa nominal.
- Jangan membuat object kosong.
- Setiap item wajib memiliki name, category, dan amount.
- Jangan masukkan grand total, subtotal, kembalian, diskon, atau ongkir sebagai item kecuali pengguna menyebutnya sebagai biaya yang dibayar.
- Jika input hanya menyebut total tanpa rincian item, buat 1 item berdasarkan konteks utama.
  Contoh: "makan di warteg total 20000" => item name "Makan Warteg", category "Culinary", amount 20000.
- Jika ada merchant dan item, merchant masuk ke transaction, bukan item.
  Contoh: "indomaret beli roti 10rb" => transaction "Belanja Indomaret", item "Roti".
- Gunakan Title Case untuk name.
- Jangan menebak item yang tidak disebutkan.

Kategori:
- Pantry: kebutuhan dapur/rumah tangga seperti beras, gula, minyak, telur, galon, gas, kopi, teh, snack stok rumah, roti untuk stok rumah.
- Laundry: cuci baju, setrika, deterjen, pewangi pakaian, laundry kiloan.
- Lavatory: kebutuhan mandi/toilet/kebersihan diri seperti sabun, sampo, odol, tisu toilet, skincare dasar.
- Transport: bensin, parkir, tol, ojek, taksi, bus, kereta, travel, gojek/grab untuk perjalanan.
- Bill: listrik, air, internet rumah, pulsa, paket data, cicilan, iuran, pajak, biaya admin, token listrik.
- Subscription: Netflix, Spotify, YouTube Premium, aplikasi berlangganan, langganan Chat GPT, subscription, biasanya yang lebih dari 100k [Semua Provider Cloud].
- Culinary: makanan/minuman siap konsumsi seperti nasi goreng, kopi cafe, makan siang, restoran, jajanan, warteg, es teh.
- Entertainment: bioskop, game, konser, karaoke, rekreasi, hiburan.
- Else: gunakan hanya jika tidak cocok dengan kategori lain.


Normalisasi nominal:
- rb, ribu, k = 1000
- puluh = 10
- ratus = 100
- cepek, cepe = 100
- gopek, gope = 500
- seceng, ceng = 1000
- goceng = 5000
- ceban = 10000
- goban, gocap = 50000
- cepek ceng = 100000
- juta, sejuta = 1000000

Aturan parsing nominal:
- "rb", "10 rb", "10 ribu", "10k" => 10000
- "15k" => 15000
- "2 ratus" => 200
- "5 puluh" => 50
- "gope" => 500
- "goceng" => 5000
- "gocap" => 50000
- Format angka Indonesia seperti "10.000", "10,000", "100.000" menjadi integer rupiah.
- Jika ada "Rp", hapus simbolnya dan ambil angkanya.
- Jika nominal ambigu, pilih interpretasi rupiah yang paling umum dalam konteks Indonesia.
- Jika nominal tidak bisa dipahami, jangan masukkan item tersebut.

Aturan khusus:
- Jika pengguna menulis beberapa item dipisahkan koma, "dan", "+", atau baris baru, pisahkan menjadi item terpisah.
- Jika satu nominal berlaku untuk satu item tepat sebelumnya, pasangkan nominal itu dengan item tersebut.
- Jika tidak ada item valid, output wajib:
{"transaction":"Transaksi","items":[]}

Contoh input:
belanja Indomaret nasi goreng 10rb, gojek 15k, sabun mandi goceng, netflix 54.000

Contoh output:
{"transaction":"Belanja Indomaret","items":[{"name":"Nasi Goreng","category":"Culinary","amount":10000},{"name":"Gojek","category":"Transport","amount":15000},{"name":"Sabun Mandi","category":"Lavatory","amount":5000},{"name":"Netflix","category":"Subscription","amount":54000}]}

Contoh input:
makan di warteg total 20rb

Contoh output:
{"transaction":"Makan Warteg","items":[{"name":"Makan Warteg","category":"Culinary","amount":20000}]}

Sekarang proses input pengguna dan kembalikan JSON valid saja.`;
}

function getOpenAiClient() {
	return new OpenAI({ baseURL: endpoint, apiKey: requireToken() });
}

function getModelClient() {
	return ModelClient(endpoint, new AzureKeyCredential(requireToken()));
}

async function getToken() {
	if (activeToken) return activeToken;
	try {
		activeToken = (await readFile(tokenFile, "utf8")).trim();
	} catch {
		activeToken = process.env.GITHUB_TOKEN?.trim() ?? "";
	}
	return activeToken;
}

function requireToken() {
	if (!activeToken) {
		activeToken = process.env.GITHUB_TOKEN?.trim() ?? "";
	}
	if (!activeToken) throw new Error("GitHub token is not configured");
	return activeToken;
}

async function saveToken(value) {
	if (typeof value !== "string" || value.trim().length < 20) {
		throw new Error("GitHub token is invalid");
	}
	activeToken = value.trim();
	await mkdir(dirname(tokenFile), { recursive: true });
	await writeFile(tokenFile, activeToken, { encoding: "utf8", mode: 0o600 });
}

function maskToken(value) {
	const visibleLength = Math.max(1, Math.ceil(value.length * 0.2));
	return `${value.slice(0, visibleLength)}${"*".repeat(value.length - visibleLength)}`;
}

function validateResult(value) {
	if (
		!value ||
		typeof value.transaction !== "string" ||
		!Array.isArray(value.items)
	) {
		throw new Error("Invalid model response");
	}
	const items = value.items
		.filter(
			(item) =>
				item &&
				typeof item.name === "string" &&
				typeof item.category === "string" &&
				Number.isSafeInteger(item.amount) &&
				item.amount > 0,
		)
		.map((item) => ({
			name: item.name.trim(),
			category:
				categories.find(
					(category) =>
						category.toLowerCase() === item.category.trim().toLowerCase(),
				) ?? "Else",
			amount: item.amount,
		}));
	return { transaction: value.transaction.trim() || "Transaksi", items };
}

function readJson(request) {
	return new Promise((resolve, reject) => {
		let body = "";
		request.on("data", (chunk) => {
			body += chunk;
			if (body.length > 12_000_000) request.destroy();
		});
		request.on("end", () => {
			try {
				resolve(JSON.parse(body));
			} catch (error) {
				reject(error);
			}
		});
		request.on("error", reject);
	});
}

function setCorsHeaders(response) {
	response.setHeader("Access-Control-Allow-Origin", "*");
	response.setHeader("Access-Control-Allow-Headers", "Content-Type");
	response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function sendJson(response, status, payload) {
	response.writeHead(status, { "Content-Type": "application/json" });
	response.end(JSON.stringify(payload));
}
