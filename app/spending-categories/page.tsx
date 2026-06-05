"use client";

import { useEffect, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSpendingDetails, SpendingDetailRow } from "@/lib/database";
import { categoryColors, normalizeSpendingCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

export default function SpendingCategoriesPage() {
	const [transactions, setTransactions] = useState<SpendingDetailRow[]>([]);

	useEffect(() => {
		getSpendingDetails().then(setTransactions);
	}, []);

	const total = transactions
		.filter((transaction) => transaction.category !== "Unused")
		.reduce((sum, transaction) => sum + transaction.amount, 0);

	return (
		<main className="min-h-dvh bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<PageHeader title="Spending Details" />
				<div>
					<p className="text-xs text-muted-foreground">Total spending</p>
					<p className="mt-1 text-2xl font-semibold tracking-tight">
						{transactions.length ? formatAmount(total) : "-"}
					</p>
				</div>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>Name</TableHead>
							<TableHead>Category</TableHead>
							<TableHead className="text-right">Spend</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{!transactions.length && (
							<TableRow>
								<TableCell className="text-center text-muted-foreground" colSpan={3}>
									-
								</TableCell>
							</TableRow>
						)}
						{transactions.map((item) => (
							<TableRow key={item.id}>
								<TableCell className="max-w-32 truncate text-xs font-medium">{item.name}</TableCell>
								<TableCell>
									<div className="flex items-center gap-2">
										<span className={cn("size-2 shrink-0 rounded-full", categoryColors[normalizeSpendingCategory(item.category)])} />
										<span className="text-[11px] text-muted-foreground">{item.category}</span>
									</div>
								</TableCell>
								<TableCell className="text-right text-[11px] font-medium">{formatAmount(item.amount)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</main>
	);
}

function formatAmount(value: number) {
	return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}
