"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getNotification, NotificationRow } from "@/lib/database";
import { cn, formatDateTime } from "@/lib/utils";
import { formatAmount, getNotificationVisual } from "@/app/notifications/page";

export default function NotificationDetailPage() {
	const [notification, setNotification] = useState<NotificationRow | null>(null);

	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("id");
		if (id) getNotification(id).then((row) => setNotification(row ?? null));
	}, []);

	if (!notification) return <main className="min-h-dvh bg-[#F8F9F7] dark:bg-background" />;
	const visual = getNotificationVisual(notification);
	const Icon = visual.icon;

	return (
		<main className="min-h-dvh bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<header className="-mx-4 -mt-[calc(env(safe-area-inset-top)+2rem)] rounded-b-[2.5rem] bg-primary px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white">
					<div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
						<Button className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white" variant="ghost" size="icon" asChild>
							<Link href="/notifications"><ArrowLeft /></Link>
						</Button>
						<h1 className="text-center text-lg font-semibold">Notification</h1><div />
					</div>
				</header>
				<Card className="rounded-[1.75rem] bg-card/80 py-7 shadow-sm ring-1 ring-white/80">
					<CardContent className="flex flex-col items-center px-6 text-center">
						<div className={cn("flex size-16 items-center justify-center rounded-full", visual.iconTone)}><Icon className="size-7" /></div>
						<h2 className="mt-5 text-xl font-semibold">{notification.title}</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.message}</p>
						{notification.amount !== 0 && <p className={cn("mt-6 text-3xl font-medium", visual.amountTone)}>{formatAmount(notification.amount)}</p>}
					</CardContent>
				</Card>
				<Card className="rounded-[1.5rem] bg-card/80 py-0 shadow-sm ring-1 ring-white/80">
					<CardContent className="flex flex-col gap-4 p-5">
						<Detail label="Status"><span className="flex items-center gap-1.5 text-emerald-600"><Check className="size-4" />{notification.status}</span></Detail>
						<Detail label="Category">{notification.category}</Detail>
						<Detail label="Time">{formatDateTime(notification.occurred_at)}</Detail>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
	return <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-medium">{children}</span></div>;
}
