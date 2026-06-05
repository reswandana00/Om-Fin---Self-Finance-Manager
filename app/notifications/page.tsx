"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Bell, ReceiptText, WalletCards } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNotifications, NotificationRow } from "@/lib/database";
import { cn, formatDateTime } from "@/lib/utils";

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState<NotificationRow[]>([]);

	useEffect(() => {
		getNotifications().then(setNotifications);
	}, []);

	return (
		<main className="min-h-dvh bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<header className="-mx-4 -mt-[calc(env(safe-area-inset-top)+2rem)] rounded-b-[2.5rem] bg-primary px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white shadow-lg shadow-primary/15">
					<div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
						<Button className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white" variant="ghost" size="icon" asChild aria-label="Back to dashboard">
							<Link href="/"><ArrowLeft /></Link>
						</Button>
						<h1 className="text-center text-lg font-semibold tracking-tight">Notifications</h1>
						<div className="relative flex size-10 items-center justify-center rounded-full bg-white/10">
							<Bell className="size-4" />
						</div>
					</div>
				</header>
				<section className="flex flex-col gap-3" aria-label="Notification list">
					{!notifications.length && (
						<p className="py-8 text-center text-sm text-muted-foreground">-</p>
					)}
					{notifications.map((notification) => {
						const visual = getNotificationVisual(notification);
						const Icon = visual.icon;
						return (
							<Link href={`/notifications/detail?id=${notification.id}`} key={notification.id}>
								<Card className="rounded-[1.5rem] bg-card/80 py-0 shadow-sm ring-1 ring-white/80 transition-transform active:scale-[0.98]">
									<CardContent className="flex items-start gap-3 p-4">
										<div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", visual.iconTone)}>
											<Icon className="size-5" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold">{notification.title}</p>
													<p className="mt-0.5 truncate text-xs text-muted-foreground">{notification.description}</p>
												</div>
												{Boolean(notification.unread) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
											</div>
											<div className="mt-3 flex items-center justify-between gap-3">
												<p className="text-[11px] text-muted-foreground">{formatDateTime(notification.occurred_at)}</p>
												{notification.amount !== 0 && <p className={cn("text-xs font-medium", visual.amountTone)}>{formatAmount(notification.amount)}</p>}
											</div>
										</div>
									</CardContent>
								</Card>
							</Link>
						);
					})}
				</section>
			</div>
		</main>
	);
}

export function getNotificationVisual(notification: NotificationRow) {
	if (notification.amount > 0) return { icon: ArrowDownLeft, iconTone: "bg-emerald-50 text-emerald-600", amountTone: "text-emerald-600" };
	if (notification.category === "Budget") return { icon: WalletCards, iconTone: "bg-sky-50 text-primary", amountTone: "" };
	if (notification.category === "Subscription") return { icon: ReceiptText, iconTone: "bg-violet-50 text-violet-500", amountTone: "text-red-500" };
	return { icon: ArrowUpRight, iconTone: "bg-red-50 text-red-500", amountTone: "text-red-500" };
}

export function formatAmount(amount: number) {
	const sign = amount > 0 ? "+" : "-";
	return `${sign}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(amount))}`;
}
