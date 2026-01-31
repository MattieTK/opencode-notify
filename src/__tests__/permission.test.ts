import { describe, expect, test, mock, beforeEach, afterEach, type Mock } from "bun:test";
import { replyToPermission } from "../permission";

describe("replyToPermission", () => {
  const originalFetch = globalThis.fetch;
  let mockFetch: Mock<(url: string, options: RequestInit) => Promise<Response>>;

  beforeEach(() => {
    // Reset fetch mock before each test
    mockFetch = mock(() => Promise.resolve(new Response(null, { status: 200 })));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("sends accept payload correctly", async () => {
    const result = await replyToPermission("req-123", "accept");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:3000/permission/req-123/reply");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ allow: true });
  });

  test("sends always payload with remember: forever", async () => {
    await replyToPermission("req-456", "always");

    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({ allow: true, remember: "forever" });
  });

  test("sends reject payload correctly", async () => {
    await replyToPermission("req-789", "reject");

    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body as string)).toEqual({ allow: false });
  });

  test("returns false for dismissed action without sending request", async () => {
    const result = await replyToPermission("req-000", "dismissed");

    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("uses custom base URL when provided", async () => {
    await replyToPermission("req-111", "accept", "http://custom:8080");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("http://custom:8080/permission/req-111/reply");
  });

  test("returns false when fetch fails", async () => {
    mockFetch = mock(() => Promise.reject(new Error("Network error")));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await replyToPermission("req-222", "accept");

    expect(result).toBe(false);
  });

  test("returns false when response is not ok", async () => {
    mockFetch = mock(() => Promise.resolve(new Response(null, { status: 500 })));
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await replyToPermission("req-333", "accept");

    expect(result).toBe(false);
  });

  test("sets correct Content-Type header", async () => {
    await replyToPermission("req-444", "accept");

    const [, options] = mockFetch.mock.calls[0];
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });
});
