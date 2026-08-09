import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCloudSession } from "./cloud-session";

const cloud = vi.hoisted(() => {
	const account = {
		authProvider: "workos" as const,
		user: {
			id: "user_123",
			email: "person@example.com",
			displayName: "Person Example",
		},
		storedAt: "2026-08-09T00:00:00.000Z",
	};
	let listener: ((value: typeof account | null) => void) | undefined;
	return {
		account,
		getSession: vi.fn(),
		signIn: vi.fn(),
		signOut: vi.fn(),
		onSessionChanged: vi.fn((next: (value: typeof account | null) => void) => {
			listener = next;
			return vi.fn();
		}),
		emit(value: typeof account | null) {
			listener?.(value);
		},
	};
});

vi.mock("./bridge", () => ({
	aoBridge: {
		cloud: {
			getSession: cloud.getSession,
			signIn: cloud.signIn,
			signOut: cloud.signOut,
			onSessionChanged: cloud.onSessionChanged,
		},
	},
}));

describe("useCloudSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cloud.getSession.mockResolvedValue(cloud.account);
		cloud.signIn.mockResolvedValue(undefined);
		cloud.signOut.mockResolvedValue(undefined);
	});

	it("loads and subscribes to the token-free account projection", async () => {
		const { result } = renderHook(() => useCloudSession());

		expect(result.current.status).toBe("loading");
		await waitFor(() => expect(result.current.status).toBe("authenticated"));
		expect(result.current.session).toEqual(cloud.account);

		act(() => cloud.emit(null));
		expect(result.current.status).toBe("unauthenticated");
		expect(result.current.session).toBeNull();
	});

	it("delegates sign-in and clears local state after sign-out", async () => {
		const { result } = renderHook(() => useCloudSession());
		await waitFor(() => expect(result.current.status).toBe("authenticated"));

		act(() => result.current.signIn());
		expect(cloud.signIn).toHaveBeenCalledOnce();

		await act(() => result.current.signOut());
		expect(cloud.signOut).toHaveBeenCalledOnce();
		expect(result.current.status).toBe("unauthenticated");
		expect(result.current.session).toBeNull();
	});
});
