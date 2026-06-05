import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function PageHeader({ title }: { title: string }) {
	return (
		<header className="-mx-4 -mt-[calc(env(safe-area-inset-top)+2rem)] rounded-b-[2.5rem] bg-primary px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.5rem)] text-white shadow-lg shadow-primary/15">
			<div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
				<Button
					className="rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
					variant="ghost"
					size="icon"
					asChild
					aria-label="Back to dashboard"
				>
					<Link href="/">
						<ArrowLeft />
					</Link>
				</Button>
				<h1 className="text-center text-lg font-semibold tracking-tight">{title}</h1>
				<div />
			</div>
		</header>
	);
}
