"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardRow, getCards } from "@/lib/database";

export default function CardsPage() {
	const [cards, setCards] = useState<CardRow[]>([]);

	useEffect(() => {
		getCards().then(setCards);
	}, []);

	return (
		<main className="min-h-dvh bg-[#F8F9F7] px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)] dark:bg-background">
			<div className="mx-auto flex w-full max-w-md flex-col gap-6">
				<PageHeader title="Cards" />
				<div className="flex items-center justify-between">
					<div>
						<p className="text-xs text-muted-foreground">Your cards</p>
						<h2 className="mt-1 text-2xl font-semibold tracking-tight">
							{cards.length ? `${cards.length} active cards` : "-"}
						</h2>
					</div>
					<Button className="rounded-full" size="icon" aria-label="Add card"><Plus /></Button>
				</div>
				<section className="flex flex-col gap-4">
					{!cards.length && (
						<p className="py-8 text-center text-sm text-muted-foreground">-</p>
					)}
					{cards.map((card) => (
						<Card className={`rounded-[1.75rem] bg-gradient-to-br ${card.tone} py-0 text-white shadow-lg ring-0`} key={card.id}>
							<CardContent className="flex min-h-48 flex-col justify-between p-6">
								<div className="flex items-center justify-between">
									<p className="text-sm font-medium text-white/80">{card.name}</p>
									<CreditCard className="size-5" />
								</div>
								<div>
									<p className="text-2xl font-semibold tracking-tight">Rp{new Intl.NumberFormat("id-ID").format(card.balance)}</p>
									<p className="mt-3 text-sm tracking-[0.18em] text-white/75">.... {card.last_four}</p>
								</div>
							</CardContent>
						</Card>
					))}
				</section>
			</div>
		</main>
	);
}
