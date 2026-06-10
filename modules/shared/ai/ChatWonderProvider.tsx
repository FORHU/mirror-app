"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  useChatWonderStream,
  type UseChatWonderStreamResult,
  type SendMessageOptions,
} from "./useChatWonderStream";
import { useMirrorStore } from "@/modules/shared/store/useMirrorStore";
import { handleStylistTarget } from "@/modules/shared/voice/sessionCommands";
import type { ChatWonderGarmentData } from "@/modules/shared/api/chat-wonder.service";
import { useAuthStore } from "@/modules/shared/store/useAuthStore";
import { authService } from "@/modules/shared/api/auth.service";

export const ChatWonderContext =
  createContext<UseChatWonderStreamResult | null>(null);

export function useChatWonderContext(): UseChatWonderStreamResult {
  const ctx = useContext(ChatWonderContext);
  if (!ctx)
    throw new Error(
      "useChatWonderContext must be used inside ChatWonderProvider",
    );
  return ctx;
}

export function ChatWonderProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const stream = useChatWonderStream();

  // Sync the last AI message content to store so destination screens can show
  // Miraj's streaming text as a loading state while the tool runs.
  useEffect(() => {
    const lastAi = [...stream.messages].reverse().find((m) => m.role === "AI");
    if (lastAi) {
      useMirrorStore.getState().setChatStreamingText(lastAi.content);
    }
  }, [stream.messages]);

  const sendMessage = useCallback(
    (text: string, options?: SendMessageOptions) => {
      return stream.sendMessage(text, {
        ...options,
        onNavEarly: (stylistData) => {
          if (stylistData?.target_url) {
            useMirrorStore.getState().setChatNavPending(true);
            void handleStylistTarget(stylistData.target_url, router, pathname);
          }
          options?.onNavEarly?.(stylistData);
        },
        onComplete: (payload) => {
          if (payload.garment_data) {
            useMirrorStore
              .getState()
              .setChatGarmentData(
                payload.garment_data as ChatWonderGarmentData,
              );
          }
          if (payload.cosmetics_data) {
            useMirrorStore
              .getState()
              .setChatCosmeticsData(payload.cosmetics_data);
          }
          if (payload.tailor_data) {
            useMirrorStore
              .getState()
              .setChatTailorData(
                payload.tailor_data as { image_url: string; gender: string },
              );
          }
          if (payload.gender_update?.gender) {
            const g = payload.gender_update.gender.toUpperCase();
            if (g === "MALE" || g === "FEMALE") {
              useAuthStore
                .getState()
                .updateUser({ gender: g as "MALE" | "FEMALE" });
              void authService
                .updateProfile({ gender: g as "MALE" | "FEMALE" })
                .catch((e) => {
                  console.warn(
                    "[ChatWonderProvider] gender_update persist failed:",
                    e,
                  );
                });
            }
          }
          useMirrorStore.getState().setChatNavPending(false);
          options?.onComplete?.(payload);
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stream.sendMessage, router, pathname],
  );

  const value = useMemo(
    () => ({ ...stream, sendMessage }),
    [stream, sendMessage],
  );

  return (
    <ChatWonderContext.Provider value={value}>
      {children}
    </ChatWonderContext.Provider>
  );
}
