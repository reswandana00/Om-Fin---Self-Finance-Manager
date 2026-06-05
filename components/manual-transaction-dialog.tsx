"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { spendingCategories } from "@/lib/categories";
import { addTransaction } from "@/lib/database";

export function ManualTransactionDialog({
	open,
	onOpenChange,
	onSaved,
	showTrigger = true,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void | Promise<void>;
	showTrigger?: boolean;
}) {
	const [name, setName] = useState("");
	const [category, setCategory] = useState("");
	const [amount, setAmount] = useState("");
	const [error, setError] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const normalizedAmount = Number(amount.replace(/\D/g, ""));
		if (!name.trim() || !category || !normalizedAmount) {
			setError("Lengkapi nama, kategori, dan nominal transaksi.");
			return;
		}

		setIsSaving(true);
		setError("");
		try {
			await addTransaction(name, category, -normalizedAmount);
			await onSaved?.();
			setName("");
			setCategory("");
			setAmount("");
			onOpenChange(false);
		} catch {
			setError("Transaksi gagal disimpan. Silakan coba lagi.");
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				onOpenChange(nextOpen);
				if (!nextOpen) setError("");
			}}
		>
			{showTrigger && (
				<DialogTrigger asChild>
					<Button className="rounded-full" variant="outline" size="icon" aria-label="Tambah transaksi">
						<Plus />
					</Button>
				</DialogTrigger>
			)}
			<DialogContent className="rounded-[2rem]">
				<form className="flex flex-col gap-6" onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Tambah transaksi</DialogTitle>
						<DialogDescription>Masukkan spending secara manual.</DialogDescription>
					</DialogHeader>
					<FieldGroup>
						<Field data-invalid={Boolean(error)}>
							<FieldLabel htmlFor="transaction-name">Nama transaksi</FieldLabel>
							<Input id="transaction-name" aria-invalid={Boolean(error)} value={name} onChange={(event) => setName(event.target.value)} placeholder="Makan siang, bensin, listrik" autoFocus />
						</Field>
						<Field data-invalid={Boolean(error)}>
							<FieldLabel htmlFor="transaction-category">Kategori</FieldLabel>
							<Select value={category} onValueChange={setCategory}>
								<SelectTrigger id="transaction-category" aria-invalid={Boolean(error)}>
									<SelectValue placeholder="Pilih kategori" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{spendingCategories.filter((item) => item !== "Unused").map((item) => (
											<SelectItem value={item} key={item}>{item}</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
						<Field data-invalid={Boolean(error)}>
							<FieldLabel htmlFor="transaction-amount">Nominal spending</FieldLabel>
							<Input id="transaction-amount" aria-invalid={Boolean(error)} inputMode="numeric" value={amount} onChange={(event) => setAmount(new Intl.NumberFormat("id-ID").format(Number(event.target.value.replace(/\D/g, ""))))} placeholder="0" />
							<FieldError>{error}</FieldError>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type="submit" disabled={isSaving}>
							<Plus data-icon="inline-start" />
							{isSaving ? "Menyimpan..." : "Simpan transaksi"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
