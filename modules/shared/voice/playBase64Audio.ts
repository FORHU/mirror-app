/**
 * Plays a base64-encoded MP3 (e.g. the `audioBase64` returned by the chat-wonder
 * `/message` endpoint when `voice: true`). Resolves when playback finishes or
 * rejects on error. No-ops gracefully when given an empty/null string.
 */
let currentAudio: HTMLAudioElement | null = null;

export async function playBase64Audio(audioBase64?: string | null): Promise<void> {
  if (!audioBase64 || typeof window === "undefined") return;

  // Stop any reply already playing so they don't overlap.
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
  currentAudio = audio;

  return new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      resolve();
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      reject(new Error("Audio playback failed"));
    };
    audio.play().catch(reject);
  });
}

/** Stops any reply audio currently playing. */
export function stopBase64Audio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
