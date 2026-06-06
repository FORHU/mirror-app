export class AudioQueue {
  private audioContext: AudioContext | null = null;
  private nextStartTime: number = 0;
  private sources: AudioBufferSourceNode[] = [];

  constructor() {
    this.initContext();
  }

  private initContext() {
    if (typeof window !== "undefined") {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (
        AudioContextClass &&
        (!this.audioContext || this.audioContext.state === "closed")
      ) {
        this.audioContext = new AudioContextClass();
      }
    }
  }

  public async enqueue(base64Audio: string) {
    if (!this.audioContext) this.initContext();
    if (!this.audioContext) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    try {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      const currentTime = this.audioContext.currentTime;

      // Reset nextStartTime to currentTime if there is a gap or we are starting fresh
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      source.start(this.nextStartTime);
      this.sources.push(source);

      // Calculate the start time for the next chunk
      this.nextStartTime += audioBuffer.duration;

      source.onended = () => {
        const index = this.sources.indexOf(source);
        if (index > -1) {
          this.sources.splice(index, 1);
        }
      };
    } catch (err) {
      console.error("[AudioQueue] Error queuing audio chunk:", err);
    }
  }

  public stop() {
    this.sources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore errors if source already stopped
      }
    });
    this.sources = [];
    this.nextStartTime = 0;
  }
}
