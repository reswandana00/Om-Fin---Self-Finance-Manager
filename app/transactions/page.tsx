"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ManualTransactionDialog } from "@/components/manual-transaction-dialog";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTransactions, TransactionRow } from "@/lib/database";
import { cn, formatDateTime } from "@/lib/utils";

export default function TransactionsPage() {
	const [transactions, setTransactions] = useState<TransactionRow[]>([]);
	const [formOpen, setFormOpen] = useState(false);

	useEffect(() => {
		getTransactions().then(setTransactions);
	}, []);

	const spending = transactions
		.filter((transaction) => transaction.amount < 0)
		.reduce((total, transaction) => total + Math.abs(transaction.amount), 0);

	return (
		<main className="min-h-dvh bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<PageHeader title="Transactions" />
				<div className="flex items-center justify-between">
					<div>
						<p className="text-xs text-muted-foreground">Total spending</p>
						<p className="mt-1 text-2xl font-semibold tracking-tight">
							{transactions.length ? formatAmount(spending) : "-"}
						</p>
					</div>
					<div className="flex gap-2">
						<ManualTransactionDialog
							open={formOpen}
							onOpenChange={setFormOpen}
							onSaved={async () => setTransactions(await getTransactions())}
						/>
						<Button className="rounded-full" variant="outline" size="icon" aria-label="Search transactions">
							<Search />
						</Button>
					</div>
				</div>
				<section>
					{!transactions.length && (
						<Empty>
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Plus />
								</EmptyMedia>
								<EmptyTitle>Belum ada transaksi</EmptyTitle>
								<EmptyDescription>
									Tambahkan spending manual jika scan, voice, atau teks tidak digunakan.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button onClick={() => setFormOpen(true)}>
									<Plus data-icon="inline-start" />
									Tambah transaksi
								</Button>
							</EmptyContent>
						</Empty>
					)}
					{transactions.length > 0 && <Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead>Transaction</TableHead>
								<TableHead className="w-24">Date</TableHead>
								<TableHead className="text-right">Amount</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{transactions.map((transaction) => {
								const income = transaction.amount >= 0;
								const Icon = income ? ArrowDownLeft : ArrowUpRight;
								return (
									<TableRow key={transaction.id}>
										<TableCell>
											<div className="flex items-center gap-2.5">
												<div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", income ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
													<Icon className="size-4" />
												</div>
												<div className="min-w-0">
													<p className="truncate text-xs font-medium">{transaction.name}</p>
													<p className="mt-0.5 truncate text-[10px] text-muted-foreground">{transaction.category}</p>
												</div>
											</div>
										</TableCell>
										<TableCell className="text-[10px] text-muted-foreground">{formatDateTime(transaction.occurred_at)}</TableCell>
										<TableCell className={cn("text-right text-[11px] font-medium", income ? "text-emerald-600" : "text-red-500")}>
											{income ? "+" : "-"}{formatAmount(Math.abs(transaction.amount))}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>}
				</section>
			</div>
		</main>
	);
}

function formatAmount(value: number) {
	return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}
