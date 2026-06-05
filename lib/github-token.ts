import {
	getStoredGithubToken,
	maskGithubToken,
	storeGithubToken,
} from "@/lib/github-models";

type GithubTokenStatus = {
	configured: boolean;
	maskedToken: string;
};

export async function getGithubTokenStatus() {
	const token = getStoredGithubToken();
	return {
		configured: Boolean(token),
		maskedToken: token ? maskGithubToken(token) : "",
	} satisfies GithubTokenStatus;
}

export async function saveGithubToken(token: string) {
	const savedToken = storeGithubToken(token);
	return {
		configured: true,
		maskedToken: maskGithubToken(savedToken),
	} satisfies GithubTokenStatus;
}
