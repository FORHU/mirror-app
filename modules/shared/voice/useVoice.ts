"use client";

import { useEffect, useRef } from "react";
import { useVoiceContext } from "./VoiceProvider";
import type { ChatWonderAction, PageContext } from "../ai/chatwonder.types";

/**
 * useVoice — page-level hook.
 *
 * Call this once per page to:
 *  - Register the page's context so ChatWonder knows what screen the user is on
 *  - Receive ChatWonder actions targeted at this page via `onAction`
 *  - Access `startListening`, `stopListening`, `isListening`, `transcript`
 *
 * Context and handler are automatically unregistered on unmount.
 */
export function useVoice(
  pageContext?: PageContext,
  onAction?: (action: ChatWonderAction) => void,
) {
  const voice       = useVoiceContext();
  const onActionRef = useRef(onAction);

  // keep the ref current without re-registering
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  useEffect(() => {
    if (!pageContext) return;
    voice.registerPage(pageContext, (action) => onActionRef.current?.(action));
    return () => voice.unregisterPage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageContext?.route, pageContext?.pageName, pageContext?.activeStep]);

  return {
    isListening:    voice.isListening,
    transcript:     voice.transcript,
    startListening: voice.startListening,
    stopListening:  voice.stopListening,
  };
}
