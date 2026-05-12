import { useState, useEffect, useCallback } from "react";
import { useMapStore } from "../store/useMapStore";

// SpeechRecognition type declarations for TS
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export const useVoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);

  const { searchLocations, searchResults, setDestination, clearNavigation, map } = useMapStore();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = "en-US";
        setRecognition(recog);
      } else {
        console.warn("Speech Recognition API not supported in this browser.");
      }
    }
  }, []);

  const handleCommand = useCallback(async (text: string) => {
    const command = text.toLowerCase();
    
    if (command.includes("navigate to") || command.includes("directions to")) {
      const destinationStr = command.replace("navigate to", "").replace("directions to", "").trim();
      if (destinationStr) {
        setTranscript(`Searching for ${destinationStr}...`);
        await searchLocations(destinationStr);
      }
    } else if (command.includes("stop navigation") || command.includes("cancel navigation")) {
      setTranscript("Canceling navigation.");
      clearNavigation();
      setTimeout(() => setTranscript(""), 3000);
    } else if (command.includes("zoom in")) {
      if (map) map.zoomIn();
      setTranscript("Zooming in.");
      setTimeout(() => setTranscript(""), 2000);
    } else if (command.includes("zoom out")) {
      if (map) map.zoomOut();
      setTranscript("Zooming out.");
      setTimeout(() => setTranscript(""), 2000);
    } else {
      setTranscript(`Command not recognized: "${text}"`);
      setTimeout(() => setTranscript(""), 4000);
    }
  }, [searchLocations, clearNavigation, map]);

  // Handle search results trigger if a voice command initiated a search
  useEffect(() => {
    if (transcript.startsWith("Searching for") && searchResults.length > 0) {
      setTranscript(`Navigating to ${searchResults[0].place_name}`);
      setDestination(searchResults[0]);
      // Clear results
      useMapStore.setState({ searchResults: [] });
      setTimeout(() => setTranscript(""), 4000);
    } else if (transcript.startsWith("Searching for") && searchResults.length === 0 && !useMapStore.getState().isSearching) {
      // If done searching and no results
      // (This logic needs to be careful about race conditions with isSearching flag, 
      // but for simplicity we rely on the user observing the UI)
    }
  }, [searchResults, transcript, setDestination]);

  useEffect(() => {
    if (!recognition) return;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("Listening...");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const text = event.results[current][0].transcript;
      handleCommand(text);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      setTranscript("Error: " + event.error);
      setTimeout(() => setTranscript(""), 3000);
    };

    recognition.onend = () => {
      setIsListening(false);
      // If we didn't handle a command that sets a transcript, clear it
    };

  }, [recognition, handleCommand]);

  const startListening = () => {
    if (recognition) {
      try {
        recognition.start();
      } catch (e) {
        console.warn("Recognition already started");
      }
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening
  };
};
