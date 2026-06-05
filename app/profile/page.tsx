"use client";

import { useEffect, useState } from "react";
import {
	Bell,
	Download,
	KeyRound,
	LockKeyhole,
	Pencil,
	Save,
	Trash2,
	UserRound,
	WalletCards,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@/components/ui/input-otp";
import {
	defaultProfile,
	FinanceProfile,
	formatCurrencySymbol,
} from "@/lib/profile";
import { cn } from "@/lib/utils";
import {
	getGithubTokenStatus,
	saveGithubToken,
} from "@/lib/github-token";
import { useKeyboardSafe } from "@/hooks/use-keyboard-safe";
import { requestNotificationPermission } from "@/lib/permissions";
import {
	hashPin,
	UNLOCKED_SESSION_KEY,
	verifyPin,
} from "@/lib/security";
import {
	clearAllData,
	getProfile,
	getTransactions,
	setPinHash,
	updateProfileDatabase,
} from "@/lib/database";

export default function ProfilePage() {
	useKeyboardSafe();
	const [profile, setProfile] = useState<FinanceProfile>(defaultProfile);
	const [editing, setEditing] = useState<"name" | "balance" | null>(null);
	const [balanceDraft, setBalanceDraft] = useState(defaultProfile.balance);
	const [status, setStatus] = useState("");
	const [securityAction, setSecurityAction] = useState<"enable" | "disable" | null>(null);
	const [pin, setPin] = useState("");
	const [pinError, setPinError] = useState("");
	const [githubTokenDraft, setGithubTokenDraft] = useState("");
	const [maskedGithubToken, setMaskedGithubToken] = useState("");
	const [editingGithubToken, setEditingGithubToken] = useState(false);
	const [githubTokenError, setGithubTokenError] = useState("");
	const [savingGithubToken, setSavingGithubToken] = useState(false);
	const [clearDataOpen, setClearDataOpen] = useState(false);
	const [clearingData, setClearingData] = useState(false);

	useEffect(() => {
		async function loadProfile() {
			const [nextProfile, tokenStatus] = await Promise.all([
				getProfile(),
				getGithubTokenStatus(),
			]);
			setProfile(nextProfile);
			setBalanceDraft(nextProfile.balance);
			setMaskedGithubToken(tokenStatus.maskedToken);
		}
		loadProfile().catch(() => {
			setGithubTokenError("Token lokal tidak dapat dibaca");
		});
	}, []);

	useEffect(() => {
		if (!status) return;
		const timeout = window.setTimeout(() => setStatus(""), 5000);
		return () => window.clearTimeout(timeout);
	}, [status]);

	function updateProfile(update: Partial<FinanceProfile>, message: string) {
		updateProfileDatabase(update).then((nextProfile) => {
			setProfile(nextProfile);
			setStatus(message);
		});
	}

	async function toggleNotifications() {
		if (profile.notifications) {
			updateProfile({ notifications: false }, "Notifications disabled");
			return;
		}

		try {
			const granted = await requestNotificationPermission();
			if (!granted) {
				setStatus("Notification permission denied. Enable it in the app settings.");
				return;
			}
			updateProfile({ notifications: true }, "Notifications enabled");
		} catch {
			setStatus("Notification permission could not be requested");
		}
	}

	async function exportTransactions() {
		const transactions = await getTransactions();
		const csv = [
			"name,category,date,amount",
			...transactions.map((transaction) =>
				[transaction.name, transaction.category, transaction.occurred_at, transaction.amount].join(","),
			),
		].join("\n");
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "finance-transactions.csv";
		anchor.click();
		URL.revokeObjectURL(url);
		setStatus("Transactions exported");
	}

	function formatBalance(value: string) {
		const digits = value.replace(/\D/g, "");
		return digits ? new Intl.NumberFormat("id-ID").format(Number(digits)) : "";
	}

	function toggleBalanceEditing() {
		if (editing === "balance") {
			updateProfile({ balance: balanceDraft }, "Balance updated");
			setEditing(null);
			return;
		}

		setBalanceDraft(profile.balance);
		setEditing("balance");
	}

	async function confirmSecurity(pinValue = pin) {
		if (pinValue.length !== 6) return;

		if (securityAction === "enable") {
			await setPinHash(await hashPin(pinValue));
			sessionStorage.setItem(UNLOCKED_SESSION_KEY, "true");
			updateProfile({ biometric: true }, "Security enabled");
			closeSecurityModal();
			return;
		}

		if (securityAction === "disable") {
			if (!(await verifyPin(pinValue))) {
				setPinError("Incorrect PIN");
				setPin("");
				return;
			}
			await setPinHash(null);
			sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
			updateProfile({ biometric: false }, "Security disabled");
			closeSecurityModal();
		}
	}

	function closeSecurityModal() {
		setSecurityAction(null);
		setPin("");
		setPinError("");
	}

	async function updateGithubToken() {
		if (!githubTokenDraft.trim()) {
			setGithubTokenError("GitHub token wajib diisi");
			return;
		}
		setSavingGithubToken(true);
		setGithubTokenError("");
		try {
			const result = await saveGithubToken(githubTokenDraft);
			setMaskedGithubToken(result.maskedToken);
			setGithubTokenDraft("");
			setEditingGithubToken(false);
		} catch (error) {
			setGithubTokenError(
				error instanceof Error ? error.message : "GitHub token gagal disimpan",
			);
		} finally {
			setSavingGithubToken(false);
		}
	}

	async function confirmClearData() {
		setClearingData(true);
		try {
			const emptyProfile = await clearAllData();
			setProfile(emptyProfile);
			setBalanceDraft("");
			setEditing(null);
			setClearDataOpen(false);
			setStatus("Semua data berhasil dihapus");
		} finally {
			setClearingData(false);
		}
	}

	return (
		<main className="min-h-dvh bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<PageHeader title="Profile" />

				<section className="flex items-center gap-4 px-1">
					<div className="flex size-16 items-center justify-center rounded-full bg-secondary text-primary">
						<UserRound className="size-7" />
					</div>
					<div className="min-w-0 flex-1">
						{editing === "name" ? (
							<input
								className="w-full border-b border-border bg-transparent py-1 text-xl font-semibold outline-none"
								value={profile.name}
								onChange={(event) =>
									setProfile({ ...profile, name: event.target.value })
								}
								onBlur={() => {
									updateProfile({ name: profile.name }, "Profile updated");
									setEditing(null);
								}}
								placeholder="Set Profile"
								autoFocus
							/>
						) : (
							<h2 className="truncate text-xl font-semibold tracking-tight">
								{profile.name || "Set Profile"}
							</h2>
						)}
						<p className="mt-1 text-xs text-muted-foreground">
							Personal account
						</p>
					</div>
					<Button
						className="rounded-full"
						variant="ghost"
						size="icon-sm"
						onClick={() => setEditing("name")}
						aria-label="Edit profile name"
					>
						<Pencil />
					</Button>
				</section>

				<Card className="rounded-[1.75rem] bg-primary py-6 text-white shadow-lg shadow-primary/15 ring-0">
					<CardContent className="flex items-start justify-between gap-4 px-6">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2 text-xs text-white/75">
								<WalletCards className="size-4" />
								Current balance
							</div>
							{editing === "balance" ? (
								<div className="mt-3 flex items-center gap-2">
									<span className="text-sm text-white/75">
										{formatCurrencySymbol(profile.currency)}
									</span>
									<input
										className="min-w-0 flex-1 border-b border-white/40 bg-transparent py-1 text-2xl font-semibold outline-none"
										value={balanceDraft}
										onChange={(event) =>
											setBalanceDraft(formatBalance(event.target.value))
										}
										inputMode="numeric"
										autoFocus
									/>
								</div>
							) : (
								<p className="mt-2 text-3xl font-semibold tracking-tight">
									{profile.balance
										? `${formatCurrencySymbol(profile.currency)}${profile.balance}`
										: "-"}
								</p>
							)}
						</div>
						<Button
							className="rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white"
							variant="ghost"
							size="icon"
							onClick={toggleBalanceEditing}
							aria-label={editing === "balance" ? "Save balance" : "Update balance"}
						>
							{editing === "balance" ? <Save /> : <Pencil />}
						</Button>
					</CardContent>
				</Card>

				<section className="flex flex-col gap-3">
					<h2 className="px-1 text-sm font-semibold">Settings</h2>
					<Card className="rounded-[1.5rem] bg-card/80 py-0 shadow-sm ring-1 ring-white/80">
						<CardContent className="divide-y divide-border/60 p-0">
							<div className="flex items-center gap-3 px-4 py-4">
								<div className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
									<span className="text-xs font-semibold">
										{formatCurrencySymbol(profile.currency)}
									</span>
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium">Currency</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Balance display currency
									</p>
								</div>
								<select
									className="rounded-full border border-border bg-white px-3 py-1.5 text-xs outline-none"
									value={profile.currency}
									onChange={(event) =>
										updateProfile(
											{
												currency: event.target
													.value as FinanceProfile["currency"],
											},
											"Currency updated",
										)
									}
								>
									<option value="IDR">IDR</option>
									<option value="USD">USD</option>
									<option value="EUR">EUR</option>
								</select>
							</div>

							<SettingToggle
								icon={Bell}
								label="Notifications"
								description="Receive finance alerts"
								checked={profile.notifications}
								onClick={toggleNotifications}
							/>
							<SettingToggle
								icon={LockKeyhole}
								label="Biometric security"
								description="Require a 6-digit PIN before access"
								checked={profile.biometric}
								onClick={() =>
									setSecurityAction(profile.biometric ? "disable" : "enable")
								}
							/>

							<div className="flex flex-col gap-3 px-4 py-4">
								<div className="flex items-center gap-3">
									<div className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
										<KeyRound className="size-4" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="text-sm font-medium">GitHub Models token</p>
										<p className="mt-0.5 truncate text-xs text-muted-foreground">
											{maskedGithubToken || "Belum dikonfigurasi"}
										</p>
									</div>
									<Button
										className="rounded-full"
										variant="ghost"
										size="icon-sm"
										onClick={() => {
											setEditingGithubToken((current) => !current);
											setGithubTokenError("");
										}}
										aria-label="Update GitHub token"
									>
										<Pencil />
									</Button>
								</div>
								{editingGithubToken && (
									<div className="flex flex-col gap-2 pl-12">
										<input
											className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
											type="password"
											value={githubTokenDraft}
											onChange={(event) => setGithubTokenDraft(event.target.value)}
											placeholder="Masukkan GitHub token"
											autoComplete="off"
										/>
										{githubTokenError && (
											<p className="text-xs text-red-500">{githubTokenError}</p>
										)}
										<Button
											className="rounded-full text-white"
											size="sm"
											onClick={updateGithubToken}
											disabled={savingGithubToken}
										>
											<Save data-icon="inline-start" />
											{savingGithubToken ? "Menyimpan..." : "Simpan token"}
										</Button>
									</div>
								)}
							</div>

							<button
								className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50"
								type="button"
								onClick={exportTransactions}
							>
								<div className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
									<Download className="size-4" />
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium">Export transactions</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										Download transaction history as CSV
									</p>
								</div>
							</button>
							<button
								className="flex w-full items-center gap-3 px-4 py-4 text-left text-red-500 transition-colors hover:bg-red-50"
								type="button"
								onClick={() => setClearDataOpen(true)}
							>
								<div className="flex size-9 items-center justify-center rounded-full bg-red-50 text-red-500">
									<Trash2 className="size-4" />
								</div>
								<div className="flex-1">
									<p className="text-sm font-medium">Hapus semua data</p>
									<p className="mt-0.5 text-xs text-red-500/70">
										Reset profile, balance, transaksi, dan pengaturan
									</p>
								</div>
							</button>
						</CardContent>
					</Card>
				</section>
			</div>

			{securityAction && (
				<div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm [padding-bottom:max(1rem,env(keyboard-inset-height,0px))]">
					<div className="flex w-full max-w-sm flex-col items-center rounded-[2rem] bg-white p-6 text-center shadow-2xl">
						<div className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
							<LockKeyhole className="size-5" />
						</div>
						<h2 className="mt-4 text-lg font-semibold">
							{securityAction === "enable" ? "Set security PIN" : "Confirm your PIN"}
						</h2>
						<p className="mt-1 text-xs text-muted-foreground">
							{securityAction === "enable"
								? "Create a 6-digit PIN required before entering the app."
								: "Enter your current PIN to disable security."}
						</p>
						<InputOTP
							containerClassName="mt-6"
							maxLength={6}
							value={pin}
							onChange={setPin}
							onComplete={(value) => confirmSecurity(value)}
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
						{pinError && <p className="mt-3 text-xs text-red-500">{pinError}</p>}
						<div className="mt-6 grid w-full grid-cols-2 gap-2">
							<Button className="rounded-full" variant="outline" onClick={closeSecurityModal}>
								Cancel
							</Button>
							<Button className="rounded-full text-white" onClick={() => confirmSecurity()} disabled={pin.length !== 6}>
								Confirm
							</Button>
						</div>
					</div>
				</div>
			)}
			<Dialog open={clearDataOpen} onOpenChange={setClearDataOpen}>
				<DialogContent className="rounded-[2rem]">
					<DialogHeader>
						<DialogTitle>Hapus semua data?</DialogTitle>
						<DialogDescription>
							Seluruh profile, balance, transaksi, kategori spending, notifikasi,
							dan PIN akan dihapus permanen. GitHub token tidak ikut dihapus.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setClearDataOpen(false)}
							disabled={clearingData}
						>
							Batal
						</Button>
						<Button
							className="bg-red-500 text-white hover:bg-red-600"
							onClick={confirmClearData}
							disabled={clearingData}
						>
							<Trash2 data-icon="inline-start" />
							{clearingData ? "Menghapus..." : "Hapus data"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{status && (
				<div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] mx-auto max-w-sm rounded-full bg-foreground/50 px-4 py-2.5 text-center text-xs text-white shadow-lg backdrop-blur-md">
					{status}
				</div>
			)}
		</main>
	);
}

function SettingToggle({
	icon: Icon,
	label,
	description,
	checked,
	onClick,
}: {
	icon: typeof Bell;
	label: string;
	description: string;
	checked: boolean;
	onClick: () => void;
}) {
	return (
		<button
			className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/50"
			type="button"
			onClick={onClick}
		>
			<div className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
				<Icon className="size-4" />
			</div>
			<div className="flex-1">
				<p className="text-sm font-medium">{label}</p>
				<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
			</div>
			<span
				className={cn(
					"flex h-6 w-11 items-center rounded-full p-0.5 transition-colors",
					checked ? "bg-primary" : "bg-muted",
				)}
			>
				<span
					className={cn(
						"size-5 rounded-full bg-white shadow-sm transition-transform",
						checked && "translate-x-5",
					)}
				/>
			</span>
		</button>
	);
}
