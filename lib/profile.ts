export type FinanceProfile = {
	name: string;
	balance: string;
	currency: "IDR" | "USD" | "EUR";
	notifications: boolean;
	biometric: boolean;
};

export const defaultProfile: FinanceProfile = {
	name: "",
	balance: "",
	currency: "IDR",
	notifications: false,
	biometric: false,
};

export function formatCurrencySymbol(currency: FinanceProfile["currency"]) {
	return currency === "IDR" ? "Rp" : currency === "USD" ? "$" : "€";
}
