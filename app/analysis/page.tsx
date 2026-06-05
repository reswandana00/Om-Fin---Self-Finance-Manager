"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useKeyboardSafe } from "@/hooks/use-keyboard-safe";
import { askAnalysisAi } from "@/lib/analysis-ai";
import {
	AnalysisPointRow,
	FinancialOverview,
	getAnalysisPoints,
	getFinancialOverview,
} from "@/lib/database";
import { cn } from "@/lib/utils";

const prompts = [
	"How can I save more?",
	"Where did I spend most?",
	"Can I afford a new phone?",
];

type Message = {
	role: "assistant" | "user";
	content: string;
};

export default function AnalysisPage() {
	useKeyboardSafe();
	const [input, setInput] = useState("");
	const [split, setSplit] = useState(50);
	const [chartData, setChartData] = useState<AnalysisPointRow[]>([]);
	const [overview, setOverview] = useState<FinancialOverview | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [isAsking, setIsAsking] = useState(false);
	const chatEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages]);

	useEffect(() => {
		Promise.all([getAnalysisPoints(), getFinancialOverview()]).then(
			([points, financialOverview]) => {
				setChartData(points);
				setOverview(financialOverview);
				setMessages([
					{ role: "assistant", content: buildMonthlyInsight(financialOverview) },
				]);
			},
		);
	}, []);

	async function askAssistant(question: string) {
		const normalizedQuestion = question.trim();
		if (!normalizedQuestion || isAsking) return;

		setMessages((current) => [...current, { role: "user", content: normalizedQuestion }]);
		setInput("");
		setIsAsking(true);
		try {
			const answer = await askAnalysisAi(normalizedQuestion);
			setMessages((current) => [...current, { role: "assistant", content: answer }]);
		} catch (error) {
			setMessages((current) => [
				...current,
				{
					role: "assistant",
					content: error instanceof Error ? error.message : "Analysis failed.",
				},
			]);
		} finally {
			setIsAsking(false);
		}
	}

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		askAssistant(input);
	}

	function handleResize(event: PointerEvent<HTMLDivElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);

		const resize = (moveEvent: globalThis.PointerEvent) => {
			const nextSplit = (moveEvent.clientY / window.innerHeight) * 100;
			setSplit(Math.min(72, Math.max(28, nextSplit)));
		};
		const stopResize = () => {
			window.removeEventListener("pointermove", resize);
			window.removeEventListener("pointerup", stopResize);
		};

		window.addEventListener("pointermove", resize);
		window.addEventListener("pointerup", stopResize);
	}

	return (
		<main className="h-dvh overflow-hidden bg-[#F8F9F7] dark:bg-background">
			<div className="relative mx-auto h-full w-full max-w-md">
				<section
					className="absolute inset-0 touch-pan-y overflow-y-scroll overscroll-contain px-4 pt-[calc(env(safe-area-inset-top)+2rem)] [-webkit-overflow-scrolling:touch]"
					aria-label="Financial visualization"
				>
					<div className="flex min-h-[125dvh] flex-col gap-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
						<PageHeader title="Analysis" />
						<Card className="shrink-0 rounded-[1.75rem] bg-card/80 shadow-sm ring-1 ring-white/80">
							<CardHeader>
								<CardDescription>Recorded cash flow</CardDescription>
								<CardTitle className="text-3xl font-medium tracking-tight">
									{overview &&
									overview.income !== null &&
									overview.expense !== null
										? formatAmount(overview.income - overview.expense)
										: "-"}
								</CardTitle>
							</CardHeader>
							<CardContent className="flex flex-col gap-5">
								<div className="flex items-center gap-4 text-xs text-muted-foreground">
									<span className="flex items-center gap-1.5">
										<span className="size-2 rounded-full bg-primary" />
										Income
									</span>
									<span className="flex items-center gap-1.5">
										<span className="size-2 rounded-full bg-primary/25" />
										Expense
									</span>
								</div>
								<div className="grid h-36 grid-cols-7 gap-2" aria-label="Cash flow chart">
									{chartData.map((item) => (
										<div className="flex min-w-0 flex-col items-center gap-2" key={item.day}>
											<div className="flex h-full w-full items-end justify-center gap-0.5">
												<div className="w-2 rounded-full bg-primary" style={{ height: `${item.income}%` }} />
												<div className="w-2 rounded-full bg-primary/25" style={{ height: `${item.expense}%` }} />
											</div>
											<span className="text-[10px] text-muted-foreground">{item.day}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
						<Card className="shrink-0 rounded-[1.5rem] bg-card/80 shadow-sm ring-1 ring-white/80">
							<CardContent className="p-5">
								<div className="flex items-center justify-between text-sm">
									<div>
										<p className="font-medium">Spending vs opening balance</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{overview &&
											overview.expense !== null &&
											overview.budget !== null
												? `${formatAmount(overview.expense)} of ${formatAmount(overview.budget)} used`
												: "-"}
										</p>
									</div>
									<span className="text-sm font-medium text-primary">
										{overview?.progress !== null && overview?.progress !== undefined
											? `${overview.progress}%`
											: "-"}
									</span>
								</div>
								<Progress className="mt-4" value={overview?.progress ?? 0} />
							</CardContent>
						</Card>
					</div>
				</section>

				<div
					className="absolute inset-x-0 z-10 flex h-5 -translate-y-1/2 touch-none cursor-row-resize items-center justify-center"
					style={{ top: `${split}%` }}
					onPointerDown={handleResize}
					role="separator"
					aria-label="Resize visualization and chatbot sections"
					aria-orientation="horizontal"
				>
					<div className="h-px w-full bg-border" />
					<div className="absolute h-1.5 w-12 rounded-full bg-muted-foreground/40" />
				</div>

				<section
					className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-5 dark:bg-background"
					style={{ height: `${100 - split}%` }}
					aria-label="Finance Assistant"
				>
					<div className="flex items-center gap-2 px-1">
						<Sparkles className="size-4 text-primary" />
						<div>
							<h2 className="font-semibold tracking-tight">Finance Assistant</h2>
							<p className="text-xs text-muted-foreground">Insights from your database</p>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-1">
						<div className="flex flex-col gap-5 py-2">
							{messages.map((message, index) => (
								<div className={cn("flex", message.role === "user" && "justify-end")} key={`${message.role}-${index}`}>
									{message.role === "user" ? (
										<p className="max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs leading-5 text-white">
											{message.content}
										</p>
									) : (
										<div className="w-full text-sm leading-6 text-foreground [&_h3]:mb-2 [&_h3]:font-semibold [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc">
											<ReactMarkdown>{message.content}</ReactMarkdown>
										</div>
									)}
								</div>
							))}
							<div ref={chatEndRef} />
						</div>
					</div>
					<div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
						{prompts.map((prompt) => (
							<Button className="shrink-0 rounded-full bg-white text-xs font-normal shadow-sm" variant="outline" size="sm" onClick={() => askAssistant(prompt)} disabled={isAsking} key={prompt}>
								{prompt}
							</Button>
						))}
					</div>
					<form className="flex shrink-0 items-center gap-2" onSubmit={handleSubmit}>
						<input className="h-11 min-w-0 flex-1 rounded-full border border-border bg-white px-4 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your finances..." aria-label="Ask Finance Assistant" />
						<Button className="rounded-full text-white" size="icon-lg" type="submit" aria-label="Send message" disabled={isAsking}>
							<Send />
						</Button>
					</form>
				</section>
			</div>
		</main>
	);
}

function buildMonthlyInsight(overview: FinancialOverview) {
	if (overview.income === null || overview.expense === null) {
		return "### Monthly insight\n\n-";
	}
	const saved = overview.income - overview.expense;
	const savingRate = overview.income > 0 ? Math.round((saved / overview.income) * 100) : 0;
	return `### Monthly insight\n\nYour recorded saving rate is **${savingRate}%**, with **${formatAmount(saved)}** remaining from recorded income and expenses.`;
}

function formatAmount(value: number) {
	const sign = value < 0 ? "-" : "";
	return `${sign}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(value))}`;
}
