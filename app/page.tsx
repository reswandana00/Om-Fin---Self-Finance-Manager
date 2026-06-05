"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";
import {
	CalendarDays,
	Camera,
	ChartNoAxesColumnIncreasing,
	ChevronDown,
	ChevronRight,
	Circle,
	Check,
	House,
	ImageIcon,
	ListChecks,
	Mail,
	Mic,
	Plus,
	ScanLine,
	Send,
	Type,
	UserRound,
	X,
	Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { ManualTransactionDialog } from "@/components/manual-transaction-dialog";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { FinanceProfile, formatCurrencySymbol } from "@/lib/profile";
import { spendingCategories } from "@/lib/categories";
import { useKeyboardSafe } from "@/hooks/use-keyboard-safe";
import { getMediaPermissionError } from "@/lib/permissions";
import {
	addDeposit,
	addScannedReceipt,
	addTransaction,
	getMonthlyCategories,
	getMonthlySummaries,
	getProfile,
} from "@/lib/database";
import {
	calculateReceiptTotal,
	parseTransactionText,
	ReceiptScanResult,
	scanReceiptImage,
} from "@/lib/receipt";

type DashboardMonthData = {
	spending: string;
	progress: number | null;
	remaining: string | null;
	categories: Array<{
		name: string;
		amount: string;
		width: string;
		color: string;
	}>;
};

const glassCard =
	"rounded-[1.75rem] bg-card/75 shadow-lg shadow-foreground/[0.04] ring-1 ring-white/80 backdrop-blur-xl";

export default function Home() {
	useKeyboardSafe();
	const [month, setMonth] = useState("");
	const [profile, setProfile] = useState<FinanceProfile | null>(null);
	const [databaseMonthlyData, setDatabaseMonthlyData] = useState<
		Record<string, DashboardMonthData>
	>({});
	const [composerMode, setComposerMode] = useState<
		"default" | "chooser" | "text" | "camera" | "voice"
	>("default");
	const [textInput, setTextInput] = useState("");
	const [voiceTranscript, setVoiceTranscript] = useState("");
	const [activity, setActivity] = useState("");
	const [scanFailed, setScanFailed] = useState(false);
	const [manualTransactionOpen, setManualTransactionOpen] = useState(false);
	const [depositOpen, setDepositOpen] = useState(false);
	const [depositAmount, setDepositAmount] = useState("");
	const [depositSource, setDepositSource] = useState("");
	const [depositError, setDepositError] = useState("");
	const [isSavingDeposit, setIsSavingDeposit] = useState(false);
	const [cameraImage, setCameraImage] = useState("");
	const [flashEnabled, setFlashEnabled] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [scannedReceipt, setScannedReceipt] =
		useState<ReceiptScanResult | null>(null);
	const [confirmation, setConfirmation] = useState<{
		name: string;
		category: string;
		spend: string;
	} | null>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraStreamRef = useRef<MediaStream | null>(null);
	const voiceTimeoutRef = useRef<number | null>(null);
	const voiceHeldRef = useRef(false);
	const voiceSessionRef = useRef(0);
	const data = databaseMonthlyData[month];

	function clearVoiceTimeout() {
		if (voiceTimeoutRef.current !== null) {
			window.clearTimeout(voiceTimeoutRef.current);
			voiceTimeoutRef.current = null;
		}
	}

	async function loadData() {
		const currentProfile = await getProfile();
		setProfile(currentProfile);
		const summaries = await getMonthlySummaries();
		const entries = await Promise.all(
			summaries.map(async (summary) => {
				const categories = await getMonthlyCategories(summary.month);
				return [
					summary.month,
					{
						spending: formatRupiah(summary.spending),
						progress:
							summary.budget > 0
								? Math.round((summary.spending / summary.budget) * 100)
								: null,
						remaining:
							summary.budget > 0 ? formatRupiah(summary.budget) : null,
						categories: categories.map((category) => ({
							name: category.name,
							amount: formatRupiah(category.amount),
							width: `${category.percentage}%`,
							color: category.color,
						})),
					},
				] as const;
			}),
		);
		const nextMonthlyData = Object.fromEntries(entries);
		setDatabaseMonthlyData(nextMonthlyData);
		setMonth((current) =>
			current && nextMonthlyData[current]
				? current
				: summaries.at(-1)?.month ?? "",
		);
	}

	useEffect(() => {
		const timeout = window.setTimeout(() => void loadData(), 0);
		return () => window.clearTimeout(timeout);
	}, []);

	useEffect(() => {
		if (!activity) return;
		const timeout = window.setTimeout(() => setActivity(""), 5000);
		return () => window.clearTimeout(timeout);
	}, [activity]);

	useEffect(() => {
		return () => {
			cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
			void SpeechRecognition.stop().catch(() => {});
		};
	}, []);

	useEffect(() => {
		if (composerMode !== "camera" || cameraImage) return;

		const video = videoRef.current;
		const stream = cameraStreamRef.current;
		if (!video || !stream) return;

		video.srcObject = stream;
		const playVideo = () => {
			void video.play().catch(() => {
				setActivity("Camera preview could not be started");
			});
		};

		if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
			playVideo();
		} else {
			video.addEventListener("loadedmetadata", playVideo, { once: true });
		}

		return () => {
			video.removeEventListener("loadedmetadata", playVideo);
			if (video.srcObject === stream) video.srcObject = null;
		};
	}, [cameraImage, composerMode]);

	function closeComposer() {
		cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
		cameraStreamRef.current = null;
		voiceHeldRef.current = false;
		voiceSessionRef.current += 1;
		clearVoiceTimeout();
		void SpeechRecognition.stop().catch(() => {});
		setIsRecording(false);
		setVoiceTranscript("");
		setCameraImage("");
		setFlashEnabled(false);
		setComposerMode("default");
	}

	async function submitText(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!textInput.trim()) return;
		closeComposer();
		setIsProcessing(true);
		setActivity("");
		try {
			setScannedReceipt(await parseTransactionText(textInput));
			setTextInput("");
		} catch (error) {
			setActivity(
				error instanceof Error ? error.message : "Transaction parsing failed",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function submitVoiceTranscript(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const transcript = voiceTranscript.trim();
		if (!transcript) return;
		void SpeechRecognition.stop().catch(() => {});
		setIsRecording(false);
		setIsProcessing(true);
		setActivity("");
		try {
			setScannedReceipt(await parseTransactionText(transcript));
			setVoiceTranscript("");
			setComposerMode("default");
		} catch (error) {
			setActivity(
				error instanceof Error ? error.message : "Transaction parsing failed",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function openCamera() {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "environment" },
				audio: false,
			});
			cameraStreamRef.current = stream;
			setComposerMode("camera");
		} catch (error) {
			setActivity(getMediaPermissionError(error, "camera"));
		}
	}

	async function captureImage() {
		const video = videoRef.current;
		if (!video) return;
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext("2d")?.drawImage(video, 0, 0);
		const image = canvas.toDataURL("image/jpeg", 0.8);
		setCameraImage(image);
		await processReceiptImage(image);
	}

	async function chooseGallery(file?: File) {
		if (!file) return;
		const image = await readFileAsDataUrl(file);
		setCameraImage(image);
		await processReceiptImage(image);
	}

	async function processReceiptImage(image: string) {
		closeComposer();
		setIsProcessing(true);
		setActivity("");
		setScanFailed(false);
		try {
			setScannedReceipt(await scanReceiptImage(image));
		} catch (error) {
			setScanFailed(true);
			setActivity(
				error instanceof Error ? error.message : "Receipt scan failed",
			);
		} finally {
			setIsProcessing(false);
		}
	}

	async function toggleFlash() {
		const track = cameraStreamRef.current?.getVideoTracks()[0];
		if (!track) return;
		const nextValue = !flashEnabled;

		try {
			await track.applyConstraints({
				advanced: [{ torch: nextValue } as MediaTrackConstraintSet],
			});
			setFlashEnabled(nextValue);
		} catch {
			setActivity("Flash is not supported on this device");
		}
	}

	async function startVoiceRecording() {
		if (isRecording) return;
		voiceHeldRef.current = true;
		const session = voiceSessionRef.current + 1;
		voiceSessionRef.current = session;
		try {
			const permissions = await SpeechRecognition.requestPermissions();
			if (permissions.speechRecognition !== "granted") {
				throw new Error("Izin speech recognition ditolak");
			}
			const availability = await SpeechRecognition.available();
			if (!availability.available) {
				throw new Error("Speech recognition tidak tersedia di perangkat ini");
			}

			setIsRecording(true);
			setActivity("");
			voiceTimeoutRef.current = window.setTimeout(() => {
				stopVoiceRecording();
				setActivity("Dengarkan suara dibatasi maksimal 12 detik");
			}, 12_000);
			const result = await SpeechRecognition.start({
				language: "id-ID",
				maxResults: 1,
				prompt: "Sebutkan transaksi",
				popup: false,
			});
			if (voiceSessionRef.current !== session) return;
			const text = result.matches?.[0]?.trim();
			if (!text) throw new Error("Tidak ada teks yang terdeteksi");
			setVoiceTranscript(text);
			setActivity("Edit hasil suara lalu kirim untuk diproses");
		} catch (error) {
			voiceHeldRef.current = false;
			setActivity(
				error instanceof Error
					? error.message
					: getMediaPermissionError(error, "microphone"),
			);
		} finally {
			if (voiceSessionRef.current === session) {
				clearVoiceTimeout();
				voiceHeldRef.current = false;
				setIsRecording(false);
			}
		}
	}

	function stopVoiceRecording() {
		voiceHeldRef.current = false;
		clearVoiceTimeout();
		void SpeechRecognition.stop().catch(() => {});
		setIsRecording(false);
	}

	async function saveConfirmation(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!confirmation) return;
		const updatedProfile = await addTransaction(
			confirmation.name,
			confirmation.category,
			-Number(confirmation.spend.replace(/\D/g, "")),
		);
		setProfile(updatedProfile);
		await loadData();
		setActivity(`${confirmation.name} saved`);
		setConfirmation(null);
		closeComposer();
	}

	async function saveDeposit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const amount = Number(depositAmount.replace(/\D/g, ""));

		if (!amount || !depositSource.trim()) {
			setDepositError("Masukkan nominal dan sumber dana.");
			return;
		}

		setIsSavingDeposit(true);
		setDepositError("");
		try {
			const updatedProfile = await addDeposit(depositSource, amount);
			setProfile(updatedProfile);
			await loadData();
			setActivity(`Deposit dari ${depositSource.trim()} berhasil disimpan`);
			setDepositAmount("");
			setDepositSource("");
			setDepositOpen(false);
		} catch {
			setDepositError("Deposit gagal disimpan. Silakan coba lagi.");
		} finally {
			setIsSavingDeposit(false);
		}
	}

	async function saveScannedReceipt(event?: FormEvent<HTMLFormElement>) {
		event?.preventDefault();
		if (!scannedReceipt) return;
		setIsProcessing(true);
		try {
			const result = await addScannedReceipt(scannedReceipt);
			setProfile(result.profile);
			await loadData();
			setActivity(
				`${scannedReceipt.transaction} saved: ${formatRupiah(result.total)}`,
			);
			setScannedReceipt(null);
		} catch {
			setActivity("Scanned receipt could not be saved");
		} finally {
			setIsProcessing(false);
		}
	}

	return (
		<main className="min-h-dvh bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-7">
				<header className="-mx-4 -mt-[calc(env(safe-area-inset-top)+2rem)] rounded-b-[2.5rem] bg-primary px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white shadow-lg shadow-primary/15">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex items-start gap-2">
								<span className="text-sm text-white/75">
									{profile ? formatCurrencySymbol(profile.currency) : ""}
								</span>
								<p className="text-3xl font-semibold tracking-tight">
									{profile?.balance || "-"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2">
							<Dialog
								open={depositOpen}
								onOpenChange={(open) => {
									setDepositOpen(open);
									if (!open) setDepositError("");
								}}
							>
								<DialogTrigger asChild>
									<Button
										className="rounded-xl border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white"
										variant="outline"
										size="icon"
										aria-label="Tambah deposit"
									>
										<Plus />
									</Button>
								</DialogTrigger>
								<DialogContent className="rounded-[2rem]">
									<form className="flex flex-col gap-6" onSubmit={saveDeposit}>
										<DialogHeader>
											<DialogTitle>Tambah deposit</DialogTitle>
											<DialogDescription>
												Masukkan dana masuk untuk memperbarui balance dan
												transaksi.
											</DialogDescription>
										</DialogHeader>
										<FieldGroup>
											<Field data-invalid={Boolean(depositError)}>
												<FieldLabel htmlFor="deposit-amount">
													Nominal deposit
												</FieldLabel>
												<div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
													<span className="pl-2.5 text-sm font-medium text-muted-foreground">
														Rp
													</span>
													<Input
														id="deposit-amount"
														className="border-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
														aria-invalid={Boolean(depositError)}
														inputMode="numeric"
														placeholder="0"
														value={depositAmount}
														onChange={(event) =>
															setDepositAmount(
																new Intl.NumberFormat("id-ID").format(
																	Number(event.target.value.replace(/\D/g, "")),
																),
															)
														}
														autoFocus
													/>
												</div>
											</Field>
											<Field data-invalid={Boolean(depositError)}>
												<FieldLabel htmlFor="deposit-source">
													Sumber dana
												</FieldLabel>
												<Input
													id="deposit-source"
													aria-invalid={Boolean(depositError)}
													placeholder="Gaji, Bank BCA, Klien"
													value={depositSource}
													onChange={(event) =>
														setDepositSource(event.target.value)
													}
												/>
												<FieldError>{depositError}</FieldError>
											</Field>
										</FieldGroup>
										<DialogFooter>
											<Button
												className="h-11 rounded-full text-white"
												type="submit"
												disabled={isSavingDeposit}
											>
												<Plus data-icon="inline-start" />
												{isSavingDeposit ? "Menyimpan..." : "Simpan deposit"}
											</Button>
										</DialogFooter>
									</form>
								</DialogContent>
							</Dialog>
							<Button
								className="rounded-xl border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white"
								variant="outline"
								size="icon"
								asChild
								aria-label="Inbox"
							>
								<Link href="/notifications">
									<Mail />
								</Link>
							</Button>
						</div>
					</div>
				</header>

				<Card className={cn(glassCard, "gap-5 py-6")}>
					<CardHeader className="px-6">
						<CardDescription>Spending this month</CardDescription>
						<CardTitle className="text-2xl font-medium tracking-tight">
							{data?.spending ?? "-"}
						</CardTitle>
						<CardAction>
							<label className="relative flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
								<CalendarDays className="size-3.5" />
								<select
									className="appearance-none bg-transparent pr-4 outline-none"
									value={month}
									onChange={(event) => setMonth(event.target.value)}
									aria-label="Select month"
								>
									{Object.keys(databaseMonthlyData).map((monthOption) => (
										<option value={monthOption} key={monthOption}>
											{monthOption}
										</option>
									))}
								</select>
								<ChevronDown className="pointer-events-none absolute right-2.5 size-3" />
							</label>
						</CardAction>
					</CardHeader>
					<CardContent className="flex flex-col gap-5 px-6">
						<div className="grid grid-cols-2 gap-2">
							<Button
								className="h-auto flex-col gap-2.5 rounded-2xl bg-white py-3.5 text-[11px] font-medium shadow-sm ring-1 ring-foreground/5 hover:bg-white active:scale-[0.98]"
								variant="ghost"
								asChild
							>
								<Link href="/transactions">
									<span className="flex size-9 items-center justify-center rounded-full bg-sky-50 text-primary">
										<ListChecks className="size-5" />
									</span>
									Transactions
								</Link>
							</Button>
							<Button
								className="h-auto flex-col gap-2.5 rounded-2xl bg-white py-3.5 text-[11px] font-medium shadow-sm ring-1 ring-foreground/5 hover:bg-white active:scale-[0.98]"
								variant="ghost"
								asChild
							>
								<Link href="/analysis">
									<span className="flex size-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
										<ChartNoAxesColumnIncreasing className="size-5" />
									</span>
									Analysis
								</Link>
							</Button>
						</div>
						<Progress
							className="h-2 bg-muted/70"
							value={data?.progress ?? 0}
							aria-label={
								data?.progress === null || data?.progress === undefined
									? "Budget usage unavailable"
									: `${data.progress} percent of budget used`
							}
						/>
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium text-primary">
								{data?.progress === null || data?.progress === undefined
									? "-"
									: `${data.progress}% used`}
							</span>
							<span className="text-muted-foreground">
								{data?.remaining ?? "-"}
							</span>
						</div>
					</CardContent>
				</Card>

				<section className="flex flex-col gap-4">
					<div className="flex items-end justify-between px-1">
						<div>
							<p className="text-xs text-muted-foreground">Overview</p>
							<h2 className="mt-1 text-xl font-semibold tracking-tight">
								Spending categories
							</h2>
						</div>
						<Button
							className="rounded-full"
							variant="ghost"
							size="icon-sm"
							asChild
							aria-label="View all categories"
						>
							<Link href="/spending-categories">
								<ChevronRight />
							</Link>
						</Button>
					</div>

					<Card className={cn(glassCard, "gap-6 py-6")}>
						<CardHeader className="px-6">
							<CardDescription>Total used</CardDescription>
							<CardTitle className="text-xl font-medium">
								{data?.spending ?? "-"}
							</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-6 px-6">
							{!data?.categories.length && (
								<p className="py-4 text-center text-sm text-muted-foreground">
									-
								</p>
							)}
							<div
								className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
								aria-label="Spending category distribution"
							>
								{data?.categories.map((category) => (
									<div
										className={category.color}
										key={category.name}
										style={{ width: category.width }}
									/>
								))}
							</div>

							<div className="grid grid-cols-2 gap-x-5 gap-y-5">
								{data?.categories.map((category) => (
									<div
										className="flex min-w-0 items-center gap-3"
										key={category.name}
									>
										<div
											className={cn(
												"size-2.5 shrink-0 rounded-full",
												category.color,
											)}
										/>
										<div className="min-w-0">
											<p className="truncate text-xs text-muted-foreground">
												{category.name}
											</p>
											<p className="truncate text-sm font-medium">
												{category.amount}
											</p>
										</div>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</section>
			</div>

			{activity && (
				<div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] mx-auto max-w-sm rounded-full bg-foreground/50 px-4 py-2.5 text-center text-xs text-white shadow-lg backdrop-blur-md">
					{activity}
				</div>
			)}

			{scanFailed && (
				<div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+9.5rem)] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-xl ring-1 ring-foreground/10">
					<div>
						<p className="text-sm font-medium">Scan gagal</p>
						<p className="text-xs text-muted-foreground">Tambahkan transaksi secara manual.</p>
					</div>
					<Button className="rounded-full" size="icon" onClick={() => setManualTransactionOpen(true)} aria-label="Tambah transaksi manual">
						<Plus />
					</Button>
				</div>
			)}

			<ManualTransactionDialog
				open={manualTransactionOpen}
				onOpenChange={setManualTransactionOpen}
				showTrigger={false}
				onSaved={async () => {
					setScanFailed(false);
					setActivity("Transaksi manual berhasil disimpan");
					await loadData();
				}}
			/>

			{isProcessing && (
				<div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-3">
						<div className="size-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
						<p className="text-sm font-medium">Processing...</p>
					</div>
				</div>
			)}

			{confirmation && (
				<div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm [padding-bottom:max(1rem,env(keyboard-inset-height,0px))]">
					<form
						className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-5 overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl"
						onSubmit={saveConfirmation}
					>
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-lg font-semibold">Confirm transaction</h2>
								<p className="mt-1 text-xs text-muted-foreground">
									Review and edit before saving
								</p>
							</div>
							<Button
								className="rounded-full"
								variant="ghost"
								size="icon-sm"
								type="button"
								onClick={() => setConfirmation(null)}
								aria-label="Close confirmation"
							>
								<X />
							</Button>
						</div>
						<label className="flex flex-col gap-2 text-xs font-medium">
							Name
							<input
								className="h-11 rounded-xl border border-border px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
								value={confirmation.name}
								onChange={(event) =>
									setConfirmation({ ...confirmation, name: event.target.value })
								}
							/>
						</label>
						<label className="flex flex-col gap-2 text-xs font-medium">
							Category
							<input
								className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
								value={confirmation.category}
								onChange={(event) =>
									setConfirmation({
										...confirmation,
										category: event.target.value,
									})
								}
								placeholder="Transaction category"
								required
							/>
						</label>
						<label className="flex flex-col gap-2 text-xs font-medium">
							Spend
							<input
								className="h-11 rounded-xl border border-border px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
								value={confirmation.spend}
								onChange={(event) =>
									setConfirmation({
										...confirmation,
										spend: new Intl.NumberFormat("id-ID").format(
											Number(event.target.value.replace(/\D/g, "")),
										),
									})
								}
								inputMode="numeric"
								placeholder="0"
							/>
						</label>
						<Button className="h-11 rounded-full text-white" type="submit">
							<Check data-icon="inline-start" />
							Save transaction
						</Button>
					</form>
				</div>
			)}

			{scannedReceipt && (
				<div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-foreground/20 p-4 backdrop-blur-sm">
					<form
						className="flex max-h-[min(78dvh,42rem)] w-full max-w-sm flex-col gap-4 overflow-hidden rounded-[2rem] bg-white p-5 shadow-2xl"
						onSubmit={saveScannedReceipt}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h2 className="text-lg font-semibold">Confirm transaction</h2>
								<p className="mt-1 text-xs text-muted-foreground">
									Review and edit AI-extracted items before saving
								</p>
							</div>
							<Button
								className="rounded-full"
								variant="ghost"
								size="icon-sm"
								onClick={() => setScannedReceipt(null)}
								aria-label="Close scanned receipt"
							>
								<X />
							</Button>
						</div>
						<label className="flex flex-col gap-2 text-xs font-medium">
							Transaction
							<Input
								value={scannedReceipt.transaction}
								onChange={(event) =>
									setScannedReceipt({
										...scannedReceipt,
										transaction: event.target.value,
									})
								}
								required
							/>
						</label>
						<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
							{scannedReceipt.items.map((item, index) => (
								<div
									className="grid gap-3 rounded-xl bg-muted/50 p-3"
									key={`${item.name}-${index}`}
								>
									<Input
										aria-label={`Item ${index + 1} name`}
										value={item.name}
										onChange={(event) =>
											setScannedReceipt({
												...scannedReceipt,
												items: scannedReceipt.items.map((current, itemIndex) =>
													itemIndex === index
														? { ...current, name: event.target.value }
														: current,
												),
											})
										}
										required
									/>
									<div className="grid grid-cols-2 gap-2">
										<select
											className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
											aria-label={`Item ${index + 1} category`}
											value={item.category}
											onChange={(event) =>
												setScannedReceipt({
													...scannedReceipt,
													items: scannedReceipt.items.map((current, itemIndex) =>
														itemIndex === index
															? { ...current, category: event.target.value }
															: current,
													),
												})
											}
										>
											{spendingCategories.map((category) => (
												<option value={category} key={category}>
													{category}
												</option>
											))}
										</select>
										<div className="flex h-9 items-center rounded-md border border-input bg-transparent shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
											<span className="pl-2.5 text-xs text-muted-foreground">Rp</span>
											<Input
												className="border-0 shadow-none focus-visible:ring-0"
												aria-label={`Item ${index + 1} amount`}
												inputMode="numeric"
												value={new Intl.NumberFormat("id-ID").format(item.amount)}
												onChange={(event) =>
													setScannedReceipt({
														...scannedReceipt,
														items: scannedReceipt.items.map((current, itemIndex) =>
															itemIndex === index
																? {
																		...current,
																		amount: Number(
																			event.target.value.replace(/\D/g, ""),
																		),
																	}
																: current,
														),
													})
												}
												required
											/>
										</div>
									</div>
								</div>
							))}
							<Button
								className="w-full rounded-xl border-dashed"
								variant="outline"
								type="button"
								onClick={() =>
									setScannedReceipt({
										...scannedReceipt,
										items: [
											...scannedReceipt.items,
											{ name: "", category: "Else", amount: 0 },
										],
									})
								}
							>
								<Plus data-icon="inline-start" />
								Tambah item
							</Button>
						</div>
						<div className="flex items-center justify-between border-t border-border pt-4">
							<span className="text-sm text-muted-foreground">Calculated total</span>
							<strong>{formatRupiah(calculateReceiptTotal(scannedReceipt.items))}</strong>
						</div>
						<Button className="h-11 rounded-full text-white" type="submit">
							<Check data-icon="inline-start" />
							Save receipt
						</Button>
					</form>
				</div>
			)}

			{composerMode === "text" && (
				<div className="fixed inset-0" onClick={closeComposer}>
					<form
						className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] mx-auto flex max-w-sm items-center gap-2 rounded-full bg-white p-2 shadow-xl ring-1 ring-foreground/10"
						onSubmit={submitText}
						onClick={(event) => event.stopPropagation()}
					>
						<input
							className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
							value={textInput}
							onChange={(event) => setTextInput(event.target.value)}
							placeholder="Type anything..."
							autoFocus
						/>
						<Button
							className="rounded-full text-white"
							size="icon"
							type="submit"
							aria-label="Send text"
						>
							<Send />
						</Button>
					</form>
					<CloseComposerButton onClick={closeComposer} />
				</div>
			)}

			{composerMode === "camera" && (
				<div className="fixed inset-0 bg-black" onClick={closeComposer}>
					{cameraImage ? (
						<Image
							className="object-cover"
							src={cameraImage}
							alt="Captured preview"
							fill
							unoptimized
						/>
					) : (
						<video
							className="size-full object-cover"
							ref={videoRef}
							autoPlay
							playsInline
							muted
							onClick={(event) => event.stopPropagation()}
						/>
					)}
					<CloseComposerButton onClick={closeComposer} dark />
				</div>
			)}

			{composerMode === "voice" && (
				<div className="fixed inset-0" onClick={closeComposer}>
					<form
						data-voice-transcript
						className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] mx-auto flex max-w-sm flex-col gap-4 rounded-[1.5rem] bg-white p-5 text-center shadow-xl ring-1 ring-foreground/10"
						onSubmit={submitVoiceTranscript}
						onClick={(event) => event.stopPropagation()}
					>
						{voiceTranscript ? (
							<>
								<div className="text-left">
									<p className="text-sm font-medium">Hasil speech to text</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Edit dulu sebelum dikirim ke AI.
									</p>
								</div>
								<textarea
									className="min-h-28 resize-none rounded-2xl border border-input bg-transparent px-4 py-3 text-left text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
									value={voiceTranscript}
									onChange={(event) => setVoiceTranscript(event.target.value)}
									autoFocus
									aria-label="Hasil speech to text"
								/>
								<div className="flex items-center gap-2">
									<Button
										className="flex-1 rounded-full"
										variant="outline"
										type="button"
										onClick={() => setVoiceTranscript("")}
									>
										Record ulang
									</Button>
									<Button className="flex-1 rounded-full text-white" type="submit">
										<Send data-icon="inline-start" />
										Send
									</Button>
								</div>
							</>
						) : (
							<>
								<p className="text-sm font-medium">
									{isRecording ? "Listening..." : "Ready to record"}
								</p>
								<div
									className="flex h-12 items-center justify-center gap-1"
									aria-label={
										isRecording ? "Speech recognition active" : undefined
									}
								>
									{[18, 32, 48, 64, 80, 96, 72, 56, 40].map(
										(threshold, index) => (
											<span
												className={cn(
													"w-1.5 rounded-full bg-primary/20 transition-all duration-150",
													isRecording && "animate-pulse bg-primary",
												)}
												key={threshold}
												style={{
													animationDelay: `${index * 80}ms`,
													height: `${12 + Math.abs(4 - index) * -1 + threshold / 3}%`,
												}}
											/>
										),
									)}
								</div>
								<p className="text-xs text-muted-foreground">
									{isRecording
										? "Release to convert speech to text"
										: "Hold the microphone and speak in Indonesian"}
								</p>
							</>
						)}
					</form>
					<CloseComposerButton onClick={closeComposer} />
				</div>
			)}

			<input
				className="hidden"
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={(event) => chooseGallery(event.target.files?.[0])}
			/>

			{composerMode === "chooser" && (
				<div className="fixed inset-0" onClick={closeComposer} />
			)}

			<nav
				className="fixed inset-x-0 bottom-0 border-t border-border/60 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
				aria-label="Main navigation"
			>
				<div className="mx-auto grid h-20 w-full max-w-md grid-cols-3 items-center px-5">
					{composerMode === "default" && (
						<>
							<NavButton
								label="Home"
								icon={<House className="size-6 stroke-[2.5]" />}
								active
							/>
							<NavButton
								label="Scan"
								icon={<ScanLine className="size-6 stroke-[2.5]" />}
								primary
								onClick={() => setComposerMode("chooser")}
							/>
							<Button
								className="mx-auto size-14 rounded-full text-muted-foreground"
								variant="ghost"
								size="icon-lg"
								asChild
								aria-label="Profile"
							>
								<Link href="/profile">
									<UserRound className="size-6 stroke-[2.5]" />
								</Link>
							</Button>
						</>
					)}

					{composerMode === "chooser" && (
						<>
							<NavButton
								label="Text"
								icon={<Type />}
								onClick={() => setComposerMode("text")}
							/>
							<NavButton
								label="Camera"
								icon={<Camera />}
								primary
								onClick={openCamera}
							/>
							<NavButton
								label="Voice"
								icon={<Mic />}
								onClick={() => setComposerMode("voice")}
							/>
						</>
					)}

					{composerMode === "text" && (
						<>
							<NavButton label="Close" icon={<X />} onClick={closeComposer} />
							<NavButton label="Text" icon={<Type />} primary />
							<div />
						</>
					)}

					{composerMode === "camera" && (
						<>
							<NavButton
								label="Gallery"
								icon={<ImageIcon />}
								onClick={() => fileInputRef.current?.click()}
							/>
							<NavButton
								label="Capture"
								icon={<Circle />}
								primary
								onClick={captureImage}
							/>
							<NavButton
								label="Flash"
								icon={<Zap />}
								active={flashEnabled}
								onClick={toggleFlash}
							/>
						</>
					)}

					{composerMode === "voice" && (
						<>
							<div />
							{voiceTranscript ? (
								<NavButton
									label="Send"
									icon={<Send />}
									primary
									onClick={() => {
										const form = document.querySelector<HTMLFormElement>(
											"form[data-voice-transcript]",
										);
										form?.requestSubmit();
									}}
								/>
							) : (
								<NavButton
									label={isRecording ? "Release for text" : "Hold to speak"}
									icon={<Mic />}
									primary
									active={isRecording}
									onPointerDown={(event) => {
										event.preventDefault();
										event.currentTarget.setPointerCapture(event.pointerId);
										void startVoiceRecording();
									}}
									onPointerUp={(event) => {
										event.preventDefault();
										stopVoiceRecording();
									}}
									onPointerCancel={stopVoiceRecording}
									onContextMenu={(event) => event.preventDefault()}
								/>
							)}
							<div />
						</>
					)}
				</div>
			</nav>
		</main>
	);
}

function formatRupiah(value: number) {
	return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function readFileAsDataUrl(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

function NavButton({
	label,
	icon,
	active,
	primary,
	onClick,
	onPointerDown,
	onPointerUp,
	onPointerCancel,
	onContextMenu,
}: {
	label: string;
	icon: React.ReactNode;
	active?: boolean;
	primary?: boolean;
	onClick?: () => void;
	onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
	onPointerUp?: React.PointerEventHandler<HTMLButtonElement>;
	onPointerCancel?: React.PointerEventHandler<HTMLButtonElement>;
	onContextMenu?: React.MouseEventHandler<HTMLButtonElement>;
}) {
	return (
		<Button
			className={cn(
				"mx-auto size-14 rounded-full",
				onPointerDown && "touch-none select-none",
				primary && "text-white shadow-lg shadow-primary/20",
				active && primary && "scale-110 shadow-primary/40",
				active && !primary && "text-primary",
			)}
			variant={primary ? "default" : active ? "secondary" : "ghost"}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onContextMenu={onContextMenu}
			aria-label={label}
		>
			{icon}
		</Button>
	);
}

function CloseComposerButton({
	onClick,
	dark,
}: {
	onClick: () => void;
	dark?: boolean;
}) {
	return (
		<Button
			className={cn(
				"absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] rounded-full shadow-lg",
				dark
					? "bg-black/30 text-white hover:bg-black/50 hover:text-white"
					: "bg-white text-foreground hover:bg-white",
			)}
			variant="ghost"
			size="icon"
			onClick={(event) => {
				event.stopPropagation();
				onClick();
			}}
			aria-label="Cancel"
		>
			<X />
		</Button>
	);
}
