export const spendingCategories = [
	"Pantry",
	"Laundry",
	"Lavatory",
	"Transport",
	"Bill",
	"Subscription",
	"Culinary",
	"Entertainment",
	"Else",
	"Unused",
] as const;

export type SpendingCategory = (typeof spendingCategories)[number];

export const categoryColors: Record<SpendingCategory, string> = {
	Pantry: "bg-amber-300",
	Laundry: "bg-sky-300",
	Lavatory: "bg-teal-300",
	Transport: "bg-violet-300",
	Bill: "bg-rose-300",
	Subscription: "bg-indigo-300",
	Culinary: "bg-orange-300",
	Entertainment: "bg-fuchsia-300",
	Else: "bg-slate-300",
	Unused: "bg-emerald-300",
};

export function normalizeSpendingCategory(value: string): SpendingCategory {
	const category = spendingCategories.find(
		(item) => item.toLowerCase() === value.trim().toLowerCase(),
	);
	return category ?? "Else";
}
