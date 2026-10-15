import { useMutation, useQueryClient } from "@tanstack/react-query";
import createTelegramBot from "@/fetchers/telegram-config/create-telegram-bot";
import createTelegramChat from "@/fetchers/telegram-config/create-telegram-chat";
import createTelegramRules from "@/fetchers/telegram-config/create-telegram-rules";
import deleteTelegramBot from "@/fetchers/telegram-config/delete-telegram-bot";
import deleteTelegramChat from "@/fetchers/telegram-config/delete-telegram-chat";
import deleteTelegramRule from "@/fetchers/telegram-config/delete-telegram-rule";
import discoverTelegramTopics from "@/fetchers/telegram-config/discover-telegram-topics";
import type { UpdateTelegramBotRequest } from "@/fetchers/telegram-config/update-telegram-bot";
import updateTelegramBot from "@/fetchers/telegram-config/update-telegram-bot";
import type { UpdateTelegramChatRequest } from "@/fetchers/telegram-config/update-telegram-chat";
import updateTelegramChat from "@/fetchers/telegram-config/update-telegram-chat";
import type { UpdateTelegramRuleRequest } from "@/fetchers/telegram-config/update-telegram-rule";
import updateTelegramRule from "@/fetchers/telegram-config/update-telegram-rule";
import verifyTelegramConfig from "@/fetchers/telegram-config/verify-telegram-config";

function useTelegramConfigInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["telegram-config"] });
}

export function useCreateTelegramConfigBot() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: createTelegramBot,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTelegramConfigBot() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (request: UpdateTelegramBotRequest) =>
      updateTelegramBot(request),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTelegramConfigBot() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (botId: string) => deleteTelegramBot(botId),
    onSuccess: () => invalidate(),
  });
}

export function useCreateTelegramConfigChat() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: createTelegramChat,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTelegramConfigChat() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (request: UpdateTelegramChatRequest) =>
      updateTelegramChat(request),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTelegramConfigChat() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (telegramChatId: string) => deleteTelegramChat(telegramChatId),
    onSuccess: () => invalidate(),
  });
}

export function useCreateTelegramConfigRules() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: createTelegramRules,
    onSuccess: () => invalidate(),
  });
}

export function useUpdateTelegramConfigRule() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (request: UpdateTelegramRuleRequest) =>
      updateTelegramRule(request),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteTelegramConfigRule() {
  const invalidate = useTelegramConfigInvalidation();
  return useMutation({
    mutationFn: (telegramRuleId: string) => deleteTelegramRule(telegramRuleId),
    onSuccess: () => invalidate(),
  });
}

export function useDiscoverTelegramTopics() {
  return useMutation({
    mutationFn: (telegramChatId: string) =>
      discoverTelegramTopics(telegramChatId),
  });
}

export function useVerifyTelegramConfig() {
  return useMutation({
    mutationFn: verifyTelegramConfig,
  });
}
