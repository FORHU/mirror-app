# Voice AI Flow: Frontend to ChatWonder

This document outlines the end-to-end data flow when a user speaks into the Smart Mirror, starting from the React frontend, passing through the Node.js backend, and hitting the ChatWonder AI.

## 1. Frontend: Audio Capture (`VoiceProvider.tsx`)

- **Microphone**: Connects to the microphone via `getUserMedia`.
- **Processing**: Captures raw `Float32` audio chunks via `ScriptProcessorNode` and converts them to 16-bit PCM (`Int16Array`).
- **Transcription Request**: When listening stops, it sends the raw binary PCM buffer to the backend (`/api/mirror/voice/transcribe`) via `mapService.transcribe()`.
- **Context Gathering**: Gathers rich local state to send to the AI:
  - User location & routing progress (via Mapbox / ORS)
  - Upcoming calendar events
  - Currently active page (`pathname`)
  - Active UI profile or modes

## 2. Backend: Transcription & Enrichment (`voice.controller.ts`)

- **Transcribe**: Converts the PCM buffer into text using `voiceService.transcribeAudio()`.
- **Ask Request**: The frontend calls `/api/mirror/voice/ask` with the `transcript` and the gathered `ctx`.
- **Enrichment**: The `VoiceController` intercepts the context and dynamically resolves the current weather conditions and reverse-geocoded location name based on the user's coordinates.

## 3. Backend: Cognitive Orchestration (`cognitive-voice.service.ts`)

- **Prompt Building**: Constructs a highly structured system prompt for the AI. This includes:
  - Behavioral rules (acting as an orchestrator, not just a chatbot).
  - Intent mapping rules (e.g., `navigate`, `calendar_save_event`).
  - Output contract (forcing the AI to return strict JSON containing `reply`, `action`, `intent`, `emotion`).
  - The dynamic context string (time, weather, navigation state).
- **Session Management**: Fetches or reuses a `session_id` from the ChatWonder API.

## 4. Backend to ChatWonder: WebSocket Stream (`chat-wonder-stream.ts`)

- **Connection**: Opens a WebSocket connection to `wss://[CHAT_WONDER_API_URL]/chat-stream`.
- **Transmission**: Sends a JSON payload with `user_input` (the massive cognitive query) and the `session_id`.
- **Streaming**: Listens to the AI's response chunks until it receives the `__END__` terminator.
- **Parsing**: `cognitive-voice.service.ts` catches the raw output, strips out non-JSON content, and parses it into a strongly typed `CognitiveResponse`.

## 5. Backend to Frontend: TTS and Response

- **TTS Generation**: The backend passes the parsed `reply` text to `voiceService.tts()` to generate an audio buffer of the spoken response.
- **Return Payload**: The controller returns a JSON object back to `VoiceProvider.tsx` containing:
  - The AI's text `reply`
  - The `action` payload (e.g., UI navigation intents)
  - The generated TTS `audioBase64` buffer.

## 6. Frontend: Execution & Playback (`VoiceProvider.tsx` & `kernel.ts`)

- **UI Kernel**: `VoiceProvider` passes the `action` to `runKernel()` and `executeAction()`, which updates the UI (e.g., navigating to `/map`, confirming an action).
- **Audio Playback**: Decodes the base64 audio buffer and plays the voice response immediately using the `AudioContext`.
