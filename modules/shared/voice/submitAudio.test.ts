// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { concatFrames, float32ToInt16, transcribeAudio } from "./submitAudio";

// ─────────────────────────────────────────────────────────────────────────────
// concatFrames
// ─────────────────────────────────────────────────────────────────────────────
describe("concatFrames", () => {
  it("returns an empty Float32Array for an empty input", () => {
    const result = concatFrames([]);
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(0);
  });

  it("returns the same samples for a single frame", () => {
    const frame = new Float32Array([0.1, 0.5, -0.3]);
    const result = concatFrames([frame]);
    expect(Array.from(result)).toEqual(Array.from(frame));
  });

  it("concatenates multiple frames in order", () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([3, 4]);
    const c = new Float32Array([5]);
    const result = concatFrames([a, b, c]);
    expect(result.length).toBe(5);
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
  });

  it("total length equals the sum of all frame lengths", () => {
    const frames = [
      new Float32Array(100),
      new Float32Array(256),
      new Float32Array(4096),
    ];
    expect(concatFrames(frames).length).toBe(4452);
  });

  it("does not mutate the input frames", () => {
    const frame = new Float32Array([1.0, -1.0]);
    const copy = new Float32Array(frame);
    concatFrames([frame]);
    expect(Array.from(frame)).toEqual(Array.from(copy));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// float32ToInt16
// ─────────────────────────────────────────────────────────────────────────────
describe("float32ToInt16", () => {
  it("maps 0.0 → 0", () => {
    const result = float32ToInt16(new Float32Array([0]));
    expect(result[0]).toBe(0);
  });

  it("maps 1.0 → 32767 (0x7fff)", () => {
    const result = float32ToInt16(new Float32Array([1.0]));
    expect(result[0]).toBe(0x7fff);
  });

  it("maps -1.0 → -32768 (-0x8000)", () => {
    const result = float32ToInt16(new Float32Array([-1.0]));
    expect(result[0]).toBe(-0x8000);
  });

  it("maps 0.5 → 16383 (floor(0.5 * 0x7fff))", () => {
    const result = float32ToInt16(new Float32Array([0.5]));
    expect(result[0]).toBe(Math.floor(0.5 * 0x7fff));
  });

  it("maps -0.5 → -16384 (-0.5 * 0x8000)", () => {
    const result = float32ToInt16(new Float32Array([-0.5]));
    expect(result[0]).toBe(-0.5 * 0x8000);
  });

  it("clamps values above 1.0 to 32767", () => {
    const result = float32ToInt16(new Float32Array([1.5, 99]));
    expect(result[0]).toBe(0x7fff);
    expect(result[1]).toBe(0x7fff);
  });

  it("clamps values below -1.0 to -32768", () => {
    const result = float32ToInt16(new Float32Array([-1.5, -99]));
    expect(result[0]).toBe(-0x8000);
    expect(result[1]).toBe(-0x8000);
  });

  it("output length equals input length", () => {
    const input = new Float32Array(1024);
    expect(float32ToInt16(input).length).toBe(1024);
  });

  it("returns an Int16Array", () => {
    expect(float32ToInt16(new Float32Array([0]))).toBeInstanceOf(Int16Array);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// transcribeAudio
// ─────────────────────────────────────────────────────────────────────────────
describe("transcribeAudio", () => {
  const SAMPLES = new Int16Array([100, 200, -100]);
  const LANG = "en-US";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(status: number, body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      }),
    );
  }

  it("returns the transcript string on success", async () => {
    mockFetch(200, { transcript: "hello world" });
    const result = await transcribeAudio({
      int16: SAMPLES,
      lang: LANG,
      token: null,
    });
    expect(result).toBe("hello world");
  });

  it("sends a POST with Content-Type application/octet-stream", async () => {
    mockFetch(200, { transcript: "ok" });
    await transcribeAudio({ int16: SAMPLES, lang: LANG, token: null });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/octet-stream",
    );
    expect(init.method).toBe("POST");
  });

  it("encodes the lang param in the URL", async () => {
    mockFetch(200, { transcript: "bonjour" });
    await transcribeAudio({ int16: SAMPLES, lang: "fr-FR", token: null });
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain("lang=fr-FR");
  });

  it("includes Authorization header when token is provided", async () => {
    mockFetch(200, { transcript: "ok" });
    await transcribeAudio({ int16: SAMPLES, lang: LANG, token: "tok_abc" });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer tok_abc",
    );
  });

  it("omits Authorization header when token is null", async () => {
    mockFetch(200, { transcript: "ok" });
    await transcribeAudio({ int16: SAMPLES, lang: LANG, token: null });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(
      (init.headers as Record<string, string>)["Authorization"],
    ).toBeUndefined();
  });

  it("sends the Int16Array buffer as the body", async () => {
    mockFetch(200, { transcript: "ok" });
    await transcribeAudio({ int16: SAMPLES, lang: LANG, token: null });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.body).toBe(SAMPLES.buffer);
  });

  it("throws with the server error message on a non-OK response", async () => {
    mockFetch(400, { error: "Audio too short" });
    await expect(
      transcribeAudio({ int16: SAMPLES, lang: LANG, token: null }),
    ).rejects.toThrow("Audio too short");
  });

  it("throws 'Transcription failed' when error response body is not parseable JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error("not json")),
      }),
    );
    await expect(
      transcribeAudio({ int16: SAMPLES, lang: LANG, token: null }),
    ).rejects.toThrow("Transcription failed");
  });

  it("returns an empty string when the transcript field is empty", async () => {
    mockFetch(200, { transcript: "" });
    const result = await transcribeAudio({
      int16: SAMPLES,
      lang: LANG,
      token: null,
    });
    expect(result).toBe("");
  });

  it("propagates network errors from fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network down")),
    );
    await expect(
      transcribeAudio({ int16: SAMPLES, lang: LANG, token: null }),
    ).rejects.toThrow("Network down");
  });
});
