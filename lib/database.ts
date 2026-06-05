"use client";

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite } from "@capacitor-community/sqlite";

import { defaultProfile, FinanceProfile } from "@/lib/profile";
import { categoryColors, normalizeSpendingCategory } from "@/lib/categories";
import { calculateReceiptTotal, ReceiptScanResult } from "@/lib/receipt";

const DATABASE = "self_finance";
let initialization: Promise<void> | null = null;
let initializing = false;

export type TransactionRow = {
	id: number;
	name: string;
	category: string;
	amount: number;
	occurred_at: string;
};

export type SpendingDetailRow = {
	id: string;
	name: string;
	category: string;
	amount: number;
	occurred_at: string;
};

export type NotificationRow = {
	id: string;
	title: string;
	description: string;
	message: string;
	amount: number;
	occurred_at: string;
	status: string;
	category: string;
	unread: number;
};

export type MonthlySummaryRow = {
	month: string;
	spending: number;
	budget: number;
	progress: number;
};

export type MonthlyCategoryRow = {
	month: string;
	name: string;
	amount: number;
	percentage: number;
	color: string;
};

export type CardRow = {
	id: number;
	name: string;
	last_four: string;
	balance: number;
	tone: string;
};

export type AnalysisPointRow = {
	day: string;
	income: number;
	expense: number;
};

export type FinancialOverview = {
	income: number | null;
	expense: number | null;
	balance: number | null;
	budget: number | null;
	progress: number | null;
};

async function persistWebStore() {
	if (Capacitor.getPlatform() === "web") {
		await CapacitorSQLite.saveToStore({ database: DATABASE });
	}
}

async function initializeWebStore() {
	if (Capacitor.getPlatform() !== "web") return;

	const { defineCustomElements } = await import("jeep-sqlite/loader");
	defineCustomElements(window);
	await customElements.whenDefined("jeep-sqlite");

	if (!document.querySelector("jeep-sqlite")) {
		document.body.appendChild(document.createElement("jeep-sqlite"));
	}

	await CapacitorSQLite.initWebStore();
}

async function initializeDatabase() {
	initializing = true;
	await initializeWebStore();

	const consistency = await CapacitorSQLite.checkConnectionsConsistency({
		dbNames: [DATABASE],
		openModes: ["RW"],
	});

	if (!consistency.result) {
		await CapacitorSQLite.createConnection({
			database: DATABASE,
			version: 1,
			encrypted: false,
			mode: "no-encryption",
			readonly: false,
		});
	}

	await CapacitorSQLite.open({ database: DATABASE, readonly: false });
	await CapacitorSQLite.execute({
		database: DATABASE,
		transaction: true,
		statements: `
			CREATE TABLE IF NOT EXISTS profile (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				name TEXT NOT NULL,
				balance TEXT NOT NULL,
				currency TEXT NOT NULL,
				notifications INTEGER NOT NULL,
				biometric INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS security (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				pin_hash TEXT
			);
			CREATE TABLE IF NOT EXISTS transactions (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				amount INTEGER NOT NULL,
				occurred_at TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS transaction_items (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				amount INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS notifications (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT NOT NULL,
				message TEXT NOT NULL,
				amount INTEGER NOT NULL DEFAULT 0,
				occurred_at TEXT NOT NULL,
				status TEXT NOT NULL,
				category TEXT NOT NULL,
				unread INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE IF NOT EXISTS monthly_summaries (
				month TEXT PRIMARY KEY,
				spending INTEGER NOT NULL,
				budget INTEGER NOT NULL,
				progress INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS monthly_categories (
				month TEXT NOT NULL,
				name TEXT NOT NULL,
				amount INTEGER NOT NULL,
				percentage INTEGER NOT NULL,
				color TEXT NOT NULL,
				PRIMARY KEY (month, name)
			);
			CREATE TABLE IF NOT EXISTS cards (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				last_four TEXT NOT NULL,
				balance INTEGER NOT NULL,
				tone TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS analysis_points (
				day TEXT PRIMARY KEY,
				income INTEGER NOT NULL,
				expense INTEGER NOT NULL,
				position INTEGER NOT NULL
			);
			CREATE TABLE IF NOT EXISTS app_metadata (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);
		`,
	});

	await resetDatabaseOnce();
	await seedDatabase();
	await refreshLatestPreSpendingBalances();
	await persistWebStore();
	initializing = false;
}

async function seedDatabase() {
	const profileCount = await query<{ count: number }>(
		"SELECT COUNT(*) AS count FROM profile",
	);
	if (!profileCount[0]?.count) {
		await run(
			"INSERT INTO profile (id, name, balance, currency, notifications, biometric) VALUES (1, ?, ?, ?, ?, ?)",
			[
				defaultProfile.name,
				defaultProfile.balance,
				defaultProfile.currency,
				Number(defaultProfile.notifications),
				Number(defaultProfile.biometric),
			],
		);
		await run("INSERT INTO security (id, pin_hash) VALUES (1, NULL)");
	}
}

async function resetDatabaseOnce() {
	const resetKey = "fresh_start_v4";
	const existing = await query<{ value: string }>(
		"SELECT value FROM app_metadata WHERE key = ?",
		[resetKey],
	);
	if (existing.length) return;

	await CapacitorSQLite.execute({
		database: DATABASE,
		transaction: true,
		statements: `
			DELETE FROM transaction_items;
			DELETE FROM transactions;
			DELETE FROM notifications;
			DELETE FROM monthly_categories;
			DELETE FROM monthly_summaries;
			DELETE FROM cards;
			DELETE FROM analysis_points;
			DELETE FROM security;
			DELETE FROM profile;
			INSERT INTO app_metadata (key, value) VALUES ('${resetKey}', 'completed');
		`,
	});
	localStorage.removeItem("self-finance-profile");
	localStorage.removeItem("self-finance-pin-hash");
}

async function refreshLatestPreSpendingBalances() {
	const summaries = await query<MonthlySummaryRow>(
		"SELECT * FROM monthly_summaries ORDER BY rowid",
	);
	if (!summaries.length) return;

	const profiles = await query<{ balance: string }>(
		"SELECT balance FROM profile WHERE id = 1",
	);
	const balance = profiles[0]?.balance ?? "";
	let balanceAfterTransaction = balance ? Number(balance.replace(/\D/g, "")) : 0;
	const transactions = await query<{ amount: number; occurred_at: string }>(
		"SELECT amount, occurred_at FROM transactions ORDER BY occurred_at DESC, id DESC",
	);
	const latestPreSpendingBalance = new Map<string, number>();

	for (const transaction of transactions) {
		const date = new Date(transaction.occurred_at);
		if (!Number.isNaN(date.getTime()) && transaction.amount < 0) {
			const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
				date,
			);
			if (!latestPreSpendingBalance.has(month)) {
				latestPreSpendingBalance.set(
					month,
					balanceAfterTransaction - transaction.amount,
				);
			}
		}
		balanceAfterTransaction -= transaction.amount;
	}

	for (const summary of summaries) {
		const budget = latestPreSpendingBalance.get(summary.month);
		if (budget === undefined) continue;
		await run(
			"UPDATE monthly_summaries SET budget = ?, progress = ? WHERE month = ?",
			[
				budget,
				budget > 0 ? Math.round((summary.spending / budget) * 100) : 0,
				summary.month,
			],
		);
	}
}

export async function getDatabase() {
	if (!initialization) initialization = initializeDatabase();
	await initialization;
}

export async function query<T>(statement: string, values: unknown[] = []) {
	if (!initialization) initialization = initializeDatabase();
	if (!initializing) await initialization;
	const result = await CapacitorSQLite.query({
		database: DATABASE,
		statement,
		values,
	});
	return (result.values ?? []) as T[];
}

export async function run(statement: string, values: unknown[] = []) {
	const result = await CapacitorSQLite.run({
		database: DATABASE,
		statement,
		values,
		transaction: true,
	});
	await persistWebStore();
	return result;
}

export async function getProfile(): Promise<FinanceProfile> {
	await getDatabase();
	const rows = await query<{
		name: string;
		balance: string;
		currency: FinanceProfile["currency"];
		notifications: number;
		biometric: number;
	}>(
		"SELECT name, balance, currency, notifications, biometric FROM profile WHERE id = 1",
	);
	const row = rows[0];
	return row
		? {
				...row,
				notifications: Boolean(row.notifications),
				biometric: Boolean(row.biometric),
			}
		: defaultProfile;
}

export async function updateProfileDatabase(update: Partial<FinanceProfile>) {
	const profile = { ...(await getProfile()), ...update };
	await run(
		"UPDATE profile SET name = ?, balance = ?, currency = ?, notifications = ?, biometric = ? WHERE id = 1",
		[
			profile.name,
			profile.balance,
			profile.currency,
			Number(profile.notifications),
			Number(profile.biometric),
		],
	);
	if (update.balance !== undefined && profile.balance) {
		const balance = Number(profile.balance.replace(/\D/g, ""));
		if (Number.isSafeInteger(balance) && balance > 0) {
			const month = new Intl.DateTimeFormat("en-US", {
				month: "long",
			}).format(new Date());
			await run(
				"INSERT INTO monthly_summaries (month, spending, budget, progress) VALUES (?, 0, ?, 0) ON CONFLICT(month) DO UPDATE SET budget = CASE WHEN spending = 0 THEN excluded.budget ELSE budget END, progress = CASE WHEN spending = 0 THEN 0 ELSE progress END",
				[month, balance],
			);
		}
	}
	return profile;
}

export async function clearAllData() {
	await getDatabase();
	await CapacitorSQLite.execute({
		database: DATABASE,
		transaction: true,
		statements: `
			DELETE FROM transaction_items;
			DELETE FROM transactions;
			DELETE FROM notifications;
			DELETE FROM monthly_categories;
			DELETE FROM monthly_summaries;
			DELETE FROM cards;
			DELETE FROM analysis_points;
			DELETE FROM security;
			DELETE FROM profile;
			INSERT INTO profile (id, name, balance, currency, notifications, biometric)
			VALUES (1, '', '', 'IDR', 0, 0);
			INSERT INTO security (id, pin_hash) VALUES (1, NULL);
		`,
	});
	localStorage.removeItem("self-finance-profile");
	localStorage.removeItem("self-finance-pin-hash");
	sessionStorage.removeItem("self-finance-unlocked");
	await persistWebStore();
	return defaultProfile;
}

export async function getPinHash() {
	await getDatabase();
	const rows = await query<{ pin_hash: string | null }>(
		"SELECT pin_hash FROM security WHERE id = 1",
	);
	return rows[0]?.pin_hash ?? null;
}

export async function setPinHash(pinHash: string | null) {
	await getDatabase();
	await run("UPDATE security SET pin_hash = ? WHERE id = 1", [pinHash]);
}

export async function getTransactions() {
	await getDatabase();
	return query<TransactionRow>(
		"SELECT id, name, category, amount, occurred_at FROM transactions ORDER BY id DESC",
	);
}

export async function addTransaction(
	name: string,
	category: string,
	amount: number,
) {
	await getDatabase();
	if (!name.trim()) throw new Error("Transaction name is required");
	if (!Number.isSafeInteger(amount) || amount === 0) {
		throw new Error("Transaction amount must not be zero");
	}

	const profile = await getProfile();
	const currentBalance = Number(profile.balance.replace(/\D/g, ""));
	const nextBalance = currentBalance + amount;
	const nextBalanceText = new Intl.NumberFormat("id-ID").format(nextBalance);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		new Date(),
	);
	const spending = Math.abs(Math.min(amount, 0));
	const normalizedCategory = normalizeSpendingCategory(category);
	const statements = [
		{
			statement:
				"INSERT INTO transactions (name, category, amount, occurred_at) VALUES (?, ?, ?, ?)",
			values: [
				name.trim(),
				normalizedCategory,
				amount,
				new Date().toISOString(),
			],
		},
		{
			statement: "UPDATE profile SET balance = ? WHERE id = 1",
			values: [nextBalanceText],
		},
	];

	if (spending > 0) {
		statements.push(
			{
				statement:
					"INSERT INTO monthly_summaries (month, spending, budget, progress) VALUES (?, ?, ?, ?) ON CONFLICT(month) DO UPDATE SET spending = spending + excluded.spending, budget = excluded.budget, progress = CASE WHEN excluded.budget > 0 THEN ROUND((spending + excluded.spending) * 100.0 / excluded.budget) ELSE 0 END",
				values: [
					month,
					spending,
					currentBalance,
					currentBalance > 0
						? Math.round((spending / currentBalance) * 100)
						: 0,
				],
			},
			{
				statement:
					"INSERT INTO monthly_categories (month, name, amount, percentage, color) VALUES (?, ?, ?, 0, ?) ON CONFLICT(month, name) DO UPDATE SET amount = amount + excluded.amount, color = excluded.color",
				values: [
					month,
					normalizedCategory,
					spending,
					categoryColors[normalizedCategory],
				],
			},
			{
				statement:
					"UPDATE monthly_categories SET percentage = ROUND(amount * 100.0 / (SELECT SUM(amount) FROM monthly_categories WHERE month = ?)) WHERE month = ?",
				values: [month, month],
			},
		);
	}

	await CapacitorSQLite.executeSet({
		database: DATABASE,
		transaction: true,
		set: statements,
	});
	await persistWebStore();
	return { ...profile, balance: nextBalanceText };
}

export async function addDeposit(source: string, amount: number) {
	await getDatabase();

	if (!source.trim()) throw new Error("Deposit source is required");
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error("Deposit amount must be greater than zero");
	}

	const profile = await getProfile();
	const currentBalance = Number(profile.balance.replace(/\D/g, ""));
	const nextBalance = currentBalance + amount;
	const nextBalanceText = new Intl.NumberFormat("id-ID").format(nextBalance);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		new Date(),
	);

	await CapacitorSQLite.executeSet({
		database: DATABASE,
		transaction: true,
		set: [
			{
				statement: "UPDATE profile SET balance = ? WHERE id = 1",
				values: [nextBalanceText],
			},
			{
				statement:
					"INSERT INTO transactions (name, category, amount, occurred_at) VALUES (?, ?, ?, ?)",
				values: [source.trim(), "Deposit", amount, new Date().toISOString()],
			},
			{
				statement:
					"INSERT INTO monthly_summaries (month, spending, budget, progress) VALUES (?, 0, ?, 0) ON CONFLICT(month) DO UPDATE SET budget = CASE WHEN spending = 0 THEN excluded.budget ELSE budget END, progress = CASE WHEN spending = 0 THEN 0 ELSE progress END",
				values: [month, nextBalance],
			},
		],
	});
	await persistWebStore();

	return { ...profile, balance: nextBalanceText };
}

export async function addScannedReceipt(receipt: ReceiptScanResult) {
	await getDatabase();
	const items = receipt.items
		.filter(
			(item) =>
				item.name.trim() &&
				item.category.trim() &&
				Number.isSafeInteger(item.amount) &&
				item.amount > 0,
		)
		.map((item) => ({
			...item,
			name: item.name.trim(),
			category: normalizeSpendingCategory(item.category),
		}));
	const total = calculateReceiptTotal(items);
	if (!receipt.transaction.trim() || !items.length || total <= 0) {
		throw new Error("Receipt must contain a transaction name and valid items");
	}

	const profile = await getProfile();
	const currentBalance = Number(profile.balance.replace(/\D/g, ""));
	const nextBalanceText = new Intl.NumberFormat("id-ID").format(
		currentBalance - total,
	);
	const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		new Date(),
	);
	const occurredAt = new Date().toISOString();
	const transactionInsert = await run(
		"INSERT INTO transactions (name, category, amount, occurred_at) VALUES (?, 'Receipt', ?, ?)",
		[receipt.transaction.trim(), -total, occurredAt],
	);
	const transactionId = transactionInsert.changes?.lastId;
	if (!transactionId)
		throw new Error("Receipt transaction could not be created");
	console.log("[DB receipt draft]", {
		transactionId,
		transaction: receipt.transaction.trim(),
		items,
	});
	const statements = [
		...items.map((item) => ({
			statement:
				"INSERT INTO transaction_items (transaction_id, name, category, amount) VALUES (?, ?, ?, ?)",
			values: [transactionId, item.name, item.category, item.amount],
		})),
		{
			statement: "UPDATE profile SET balance = ? WHERE id = 1",
			values: [nextBalanceText],
		},
		{
			statement:
				"INSERT INTO monthly_summaries (month, spending, budget, progress) VALUES (?, ?, ?, ?) ON CONFLICT(month) DO UPDATE SET spending = spending + excluded.spending, budget = excluded.budget, progress = CASE WHEN excluded.budget > 0 THEN ROUND((spending + excluded.spending) * 100.0 / excluded.budget) ELSE 0 END",
			values: [
				month,
				total,
				currentBalance,
				currentBalance > 0 ? Math.round((total / currentBalance) * 100) : 0,
			],
		},
		...items.map((item) => ({
			statement:
				"INSERT INTO monthly_categories (month, name, amount, percentage, color) VALUES (?, ?, ?, 0, ?) ON CONFLICT(month, name) DO UPDATE SET amount = amount + excluded.amount, color = excluded.color",
			values: [
				month,
				item.category,
				item.amount,
				categoryColors[item.category],
			],
		})),
		{
			statement:
				"UPDATE monthly_categories SET percentage = ROUND(amount * 100.0 / (SELECT SUM(amount) FROM monthly_categories WHERE month = ?)) WHERE month = ?",
			values: [month, month],
		},
	];

	await CapacitorSQLite.executeSet({
		database: DATABASE,
		transaction: true,
		set: statements,
	});
	await persistWebStore();
	console.log(
		"[DB saved receipt items]",
		await query<SpendingDetailRow>(
			"SELECT CAST(id AS TEXT) AS id, name, category, amount, '' AS occurred_at FROM transaction_items WHERE transaction_id = ?",
			[transactionId],
		),
	);
	return { profile: { ...profile, balance: nextBalanceText }, total };
}

export async function getNotifications() {
	await getDatabase();
	return query<NotificationRow>(
		"SELECT * FROM notifications ORDER BY rowid DESC",
	);
}

export async function getNotification(id: string) {
	await getDatabase();
	const rows = await query<NotificationRow>(
		"SELECT * FROM notifications WHERE id = ?",
		[id],
	);
	return rows[0];
}

export async function getMonthlySummaries() {
	await getDatabase();
	return query<MonthlySummaryRow>(
		"SELECT * FROM monthly_summaries ORDER BY rowid",
	);
}

export async function getSpendingDetails() {
	await getDatabase();
	const [rows, summaries] = await Promise.all([
		query<SpendingDetailRow>(`
		SELECT 'item-' || item.id AS id, item.name, item.category, item.amount, transactions.occurred_at
		FROM transaction_items AS item
		JOIN transactions ON transactions.id = item.transaction_id
		UNION ALL
		SELECT 'transaction-' || transactions.id AS id, transactions.name, transactions.category, ABS(transactions.amount) AS amount, transactions.occurred_at
		FROM transactions
		WHERE transactions.amount < 0
			AND NOT EXISTS (
				SELECT 1 FROM transaction_items WHERE transaction_items.transaction_id = transactions.id
			)
		ORDER BY occurred_at DESC
	`),
		query<MonthlySummaryRow>(
			"SELECT * FROM monthly_summaries ORDER BY rowid DESC LIMIT 1",
		),
	]);
	const details = rows.map((row) => ({
		...row,
		category: normalizeSpendingCategory(row.category),
	}));
	const openingBalance = summaries[0]?.budget ?? 0;
	if (openingBalance > 0) {
		details.push({
			id: "opening-balance",
			name: "Opening Balance",
			category: "Unused",
			amount: openingBalance,
			occurred_at: "",
		});
	}
	return details;
}

export async function getMonthlyCategories(month: string) {
	await getDatabase();
	const rows = await query<MonthlyCategoryRow>(
		"SELECT * FROM monthly_categories WHERE month = ? ORDER BY rowid",
		[month],
	);
	const grouped = new Map<string, MonthlyCategoryRow>();
	for (const row of rows) {
		const category = normalizeSpendingCategory(row.name);
		const existing = grouped.get(category);
		grouped.set(category, {
			...row,
			name: category,
			amount: (existing?.amount ?? 0) + row.amount,
			color: categoryColors[category],
		});
	}
	const summaries = await query<MonthlySummaryRow>(
		"SELECT * FROM monthly_summaries WHERE month = ? LIMIT 1",
		[month],
	);
	const summary = summaries[0];
	if (summary?.budget > 0) {
		const unused = Math.max(summary.budget - summary.spending, 0);
		grouped.set("Unused", {
			month,
			name: "Unused",
			amount: unused,
			percentage: Math.round((unused / summary.budget) * 100),
			color: categoryColors.Unused,
		});
	}
	const result = Array.from(grouped.values());
	const total =
		summary?.budget > 0
			? summary.budget
			: result.reduce((sum, row) => sum + row.amount, 0);
	return result.map((row) => {
		return {
			...row,
			percentage: total > 0 ? Math.round((row.amount / total) * 100) : 0,
		};
	});
}

export async function getCards() {
	await getDatabase();
	return query<CardRow>("SELECT * FROM cards ORDER BY id");
}

export async function getAnalysisPoints() {
	await getDatabase();
	const rows = await query<{ amount: number; occurred_at: string }>(
		"SELECT amount, occurred_at FROM transactions ORDER BY occurred_at",
	);
	const days = Array.from({ length: 7 }, (_, offset) => {
		const date = new Date();
		date.setHours(0, 0, 0, 0);
		date.setDate(date.getDate() - (6 - offset));
		return {
			date,
			day: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date),
			income: 0,
			expense: 0,
		};
	});

	for (const row of rows) {
		const occurredAt = new Date(row.occurred_at);
		if (Number.isNaN(occurredAt.getTime())) continue;
		const point = days.find(
			(day) => day.date.toDateString() === occurredAt.toDateString(),
		);
		if (!point) continue;
		if (row.amount >= 0) point.income += row.amount;
		else point.expense += Math.abs(row.amount);
	}

	const maximum = Math.max(
		1,
		...days.flatMap((day) => [day.income, day.expense]),
	);
	return days.map(({ day, income, expense }) => ({
		day,
		income: Math.round((income / maximum) * 100),
		expense: Math.round((expense / maximum) * 100),
	}));
}

export async function getFinancialOverview(): Promise<FinancialOverview> {
	await getDatabase();
	const [totals, profile, summary] = await Promise.all([
		query<{ count: number; income: number; expense: number }>(
			"SELECT COUNT(*) AS count, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income, COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense FROM transactions",
		),
		getProfile(),
		query<{ budget: number; progress: number }>(
			"SELECT budget, progress FROM monthly_summaries ORDER BY rowid DESC LIMIT 1",
		),
	]);

	return {
		income: totals[0]?.count ? totals[0].income : null,
		expense: totals[0]?.count ? totals[0].expense : null,
		balance: profile.balance
			? Number(profile.balance.replace(/\D/g, ""))
			: null,
		budget: summary[0]?.budget ?? null,
		progress: summary[0]?.budget ? summary[0].progress : null,
	};
}
