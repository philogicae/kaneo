import {
  Bot as BotIcon,
  Check,
  ChevronDown,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  useCreateTelegramConfigBot,
  useCreateTelegramConfigChat,
  useCreateTelegramConfigRules,
  useDeleteTelegramConfigBot,
  useDeleteTelegramConfigChat,
  useDeleteTelegramConfigRule,
  useDiscoverTelegramTopics,
  useUpdateTelegramConfigBot,
  useUpdateTelegramConfigChat,
  useUpdateTelegramConfigRule,
  useVerifyTelegramConfig,
} from "@/hooks/mutations/telegram-config/use-telegram-config";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetTelegramConfig from "@/hooks/queries/telegram-config/use-get-telegram-config";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import type {
  TelegramConfigBot,
  TelegramConfigChat,
  TelegramRuleScope,
  TelegramTopic,
  TelegramVerifyResult,
} from "@/types/telegram-config";

type WorkspaceSelection = {
  all: boolean;
  projectIds: Set<string>;
};

export function TelegramConfigCard() {
  const { t } = useTranslation();
  const { data: config, isLoading } = useGetTelegramConfig();
  const verify = useVerifyTelegramConfig();

  type BotDialog =
    | { mode: "add" }
    | { mode: "edit"; bot: TelegramConfigBot }
    | null;
  type ChatDialog =
    | { mode: "add"; bot: TelegramConfigBot }
    | { mode: "edit"; bot: TelegramConfigBot; chat: TelegramConfigChat }
    | null;

  const [botDialog, setBotDialog] = useState<BotDialog>(null);
  const [chatDialog, setChatDialog] = useState<ChatDialog>(null);
  const [addRulesForChat, setAddRulesForChat] =
    useState<TelegramConfigChat | null>(null);

  const bots = config?.bots ?? [];

  const handleMutationError = (error: unknown) => {
    toast.error(
      error instanceof Error
        ? error.message.replace(/^Error: /, "")
        : t("settings:telegramUnified.toastError"),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("settings:telegramUnified.accountHint", { count: bots.length })}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          onClick={() => setBotDialog({ mode: "add" })}
        >
          <Plus className="size-4" />
          {t("settings:telegramUnified.addBot")}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner className="size-5" />
        </div>
      ) : bots.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          {t("settings:telegramUnified.emptyWorkspace")}
        </p>
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <BotSection
              key={bot.id}
              bot={bot}
              onEditBot={() => setBotDialog({ mode: "edit", bot })}
              onAddChat={() => setChatDialog({ mode: "add", bot })}
              onEditChat={(chat) => setChatDialog({ mode: "edit", bot, chat })}
              onAddRules={(chat) => setAddRulesForChat(chat)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("settings:telegramUnified.compatibilityNote")}
      </p>

      <BotFormDialog
        dialog={botDialog}
        onClose={() => setBotDialog(null)}
        verifying={verify.isPending}
        onVerify={async (botToken) => {
          const result = await verify.mutateAsync({ botToken });
          return result.bot?.username ?? null;
        }}
        onVerifyStored={async (botId) => {
          const result = await verify.mutateAsync({ botId });
          return result.bot?.username ?? null;
        }}
        onVerifyError={handleMutationError}
        onSaveError={handleMutationError}
      />
      <ChatFormDialog
        dialog={chatDialog}
        onClose={() => setChatDialog(null)}
        verifying={verify.isPending}
        onVerify={async (botId, chatId) => {
          const result: TelegramVerifyResult = await verify.mutateAsync({
            botId,
            chatId,
          });
          return result.chat ?? null;
        }}
        onVerifyError={handleMutationError}
        onSaveError={handleMutationError}
      />
      <AddRulesDialog
        chat={addRulesForChat}
        onClose={() => setAddRulesForChat(null)}
      />
    </div>
  );
}

// Same keys as the legacy per-project integration; labels come from
// settings:telegramIntegration.events.* so both surfaces stay in sync.
const BOT_EVENT_KEYS = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

function BotSection({
  bot,
  onEditBot,
  onAddChat,
  onEditChat,
  onAddRules,
}: {
  bot: TelegramConfigBot;
  onEditBot: () => void;
  onAddChat: () => void;
  onEditChat: (chat: TelegramConfigChat) => void;
  onAddRules: (chat: TelegramConfigChat) => void;
}) {
  const { t } = useTranslation();
  const deleteBot = useDeleteTelegramConfigBot();
  const updateBot = useUpdateTelegramConfigBot();
  const [eventsOpen, setEventsOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteBot.mutateAsync(bot.id);
      toast.success(t("settings:telegramUnified.toastDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleEvent = async (
    key: (typeof BOT_EVENT_KEYS)[number],
    checked: boolean,
  ) => {
    try {
      await updateBot.mutateAsync({
        botId: bot.id,
        events: { ...bot.events, [key]: checked },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="rounded-lg border border-border/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <BotIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {bot.name || t("settings:telegramUnified.unnamedBot")}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {bot.maskedBotToken}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={onAddChat}
          >
            <Plus className="size-3" />
            {t("settings:telegramUnified.addChat")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={onEditBot}
            aria-label={t("settings:telegramUnified.editBot")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            disabled={deleteBot.isPending}
            onClick={handleDelete}
            aria-label={t("settings:telegramUnified.deleteBot")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 p-3">
        {(bot.chats ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("settings:telegramUnified.emptyChats")}
          </p>
        ) : (
          (bot.chats ?? []).map((chat) => (
            <ChatSection
              key={chat.id}
              chat={chat}
              onEditChat={onEditChat}
              onAddRules={onAddRules}
            />
          ))
        )}
      </div>

      <div className="border-t border-border/60 px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setEventsOpen((open) => !open)}
          aria-expanded={eventsOpen}
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              eventsOpen && "rotate-180",
            )}
          />
          {t("settings:telegramIntegration.eventsTitle")}
        </button>
        {eventsOpen && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {BOT_EVENT_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-1"
              >
                <span className="text-xs">
                  {t(`settings:telegramIntegration.events.${key}`)}
                </span>
                <Switch
                  checked={bot.events[key]}
                  disabled={updateBot.isPending}
                  onCheckedChange={(checked) => toggleEvent(key, checked)}
                  aria-label={t(`settings:telegramIntegration.events.${key}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatSection({
  chat,
  onEditChat,
  onAddRules,
}: {
  chat: TelegramConfigChat;
  onEditChat: (chat: TelegramConfigChat) => void;
  onAddRules: (chat: TelegramConfigChat) => void;
}) {
  const { t } = useTranslation();
  // Server-built trees normally carry arrays, but a null here crashes the
  // whole page through the root error boundary.
  const rules = chat.rules ?? [];
  const updateRule = useUpdateTelegramConfigRule();
  const deleteRule = useDeleteTelegramConfigRule();
  const deleteChat = useDeleteTelegramConfigChat();

  const handleDeleteChat = async () => {
    try {
      await deleteChat.mutateAsync(chat.id);
      toast.success(t("settings:telegramUnified.toastDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const scopeLabel = (rule: TelegramConfigChat["rules"][number]) => {
    const workspace = rule.workspaceName ?? "?";
    const project = rule.projectId
      ? (rule.projectName ?? t("settings:telegramUnified.unknownProject"))
      : t("settings:telegramUnified.wholeWorkspace");
    return `${workspace} · ${project}`;
  };

  const toggleRule = async (
    rule: TelegramConfigChat["rules"][number],
    checked: boolean,
  ) => {
    try {
      await updateRule.mutateAsync({
        telegramRuleId: rule.id,
        isActive: checked,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const removeRule = async (rule: TelegramConfigChat["rules"][number]) => {
    try {
      await deleteRule.mutateAsync(rule.id);
      toast.success(t("settings:telegramUnified.toastDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="rounded-md border border-border/50 bg-muted/20">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{chat.label || chat.chatId}</span>
          {chat.label && (
            <span className="truncate font-mono text-xs text-muted-foreground">
              {chat.chatId}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onAddRules(chat)}
          >
            <Plus className="size-3" />
            {t("settings:telegramUnified.addRule")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onEditChat(chat)}
            aria-label={t("settings:telegramUnified.editChat")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            disabled={deleteChat.isPending}
            onClick={handleDeleteChat}
            aria-label={t("settings:telegramUnified.deleteChat")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {rules.length > 0 && (
        <div className="space-y-1.5 border-t border-border/50 px-3 py-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">{scopeLabel(rule)}</span>
                {rule.threadId !== null && (
                  <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    topic {rule.threadId}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={rule.isActive}
                  disabled={updateRule.isPending}
                  onCheckedChange={(checked) => toggleRule(rule, checked)}
                  aria-label={t("settings:telegramUnified.ruleActive")}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-destructive hover:text-destructive"
                  disabled={deleteRule.isPending}
                  onClick={() => removeRule(rule)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BotFormDialog({
  dialog,
  onClose,
  verifying,
  onVerify,
  onVerifyStored,
  onVerifyError,
  onSaveError,
}: {
  dialog: { mode: "add" } | { mode: "edit"; bot: TelegramConfigBot } | null;
  onClose: () => void;
  verifying: boolean;
  // Raw token (either mode).
  onVerify: (botToken: string) => Promise<string | null>;
  // Stored token (edit mode with an untouched token field).
  onVerifyStored: (botId: string) => Promise<string | null>;
  onVerifyError: (error: unknown) => void;
  onSaveError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const createBot = useCreateTelegramConfigBot();
  const updateBot = useUpdateTelegramConfigBot();
  const editing = dialog?.mode === "edit" ? dialog.bot : null;
  const open = dialog !== null;
  const [botToken, setBotToken] = useState("");
  const [name, setName] = useState("");
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBotToken("");
      setName(editing?.name ?? "");
      setVerifiedUsername(null);
    }
  }, [open, editing]);

  const handleVerify = async () => {
    setVerifiedUsername(null);
    try {
      // With no token entered, an existing bot verifies against its stored
      // token (rotate-friendly).
      const username = botToken
        ? await onVerify(botToken)
        : editing
          ? await onVerifyStored(editing.id)
          : null;
      setVerifiedUsername(username);
    } catch (error) {
      onVerifyError(error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await updateBot.mutateAsync({
          botId: editing.id,
          name: name || null,
          ...(botToken ? { botToken } : {}),
        });
      } else {
        await createBot.mutateAsync({
          botToken,
          name: name || undefined,
        });
      }
      toast.success(t("settings:telegramUnified.toastSaved"));
      onClose();
    } catch (error) {
      onSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  const canSave = editing
    ? name.trim().length > 0 || botToken.length > 0
    : botToken.length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-111.5">
        <DialogHeader>
          <DialogTitle>
            {t(
              editing
                ? "settings:telegramUnified.editBot"
                : "settings:telegramUnified.addBot",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              editing
                ? "settings:telegramUnified.editBotDescription"
                : "settings:telegramUnified.addBotDescription",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="telegram-bot-token">
              {t("settings:telegramUnified.botToken")}
            </label>
            <Input
              id="telegram-bot-token"
              type="password"
              value={botToken}
              placeholder={
                editing
                  ? t("settings:telegramUnified.botTokenKeepHint")
                  : "123456789:AA..."
              }
              onChange={(event) => setBotToken(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="telegram-bot-name">
              {t("settings:telegramUnified.botName")}
            </label>
            <Input
              id="telegram-bot-name"
              value={name}
              placeholder={t("settings:telegramUnified.botNamePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {verifiedUsername && (
            <p className="flex items-center gap-1.5 text-xs text-success-foreground">
              <Check className="size-3.5" />
              {t("settings:telegramUnified.verifyBotOk", {
                username: verifiedUsername,
              })}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(!botToken && !editing) || verifying}
            onClick={handleVerify}
            className="gap-2"
          >
            {verifying && <Spinner className="size-3" />}
            {t("settings:telegramUnified.verify")}
          </Button>
          <Button
            size="sm"
            disabled={!canSave || saving}
            onClick={handleSave}
            className="gap-2"
          >
            {saving && <Spinner className="size-3" />}
            {t("settings:telegramUnified.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChatFormDialog({
  dialog,
  onClose,
  verifying,
  onVerify,
  onVerifyError,
  onSaveError,
}: {
  dialog:
    | { mode: "add"; bot: TelegramConfigBot }
    | { mode: "edit"; bot: TelegramConfigBot; chat: TelegramConfigChat }
    | null;
  onClose: () => void;
  verifying: boolean;
  onVerify: (
    botId: string,
    chatId: string,
  ) => Promise<TelegramVerifyResult["chat"]>;
  onVerifyError: (error: unknown) => void;
  onSaveError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const createChat = useCreateTelegramConfigChat();
  const updateChat = useUpdateTelegramConfigChat();
  const editing = dialog?.mode === "edit" ? dialog.chat : null;
  const bot = dialog?.mode === "edit" ? dialog.bot : (dialog?.bot ?? null);
  const open = dialog !== null;
  const [chatId, setChatId] = useState("");
  const [label, setLabel] = useState("");
  const [verifiedChat, setVerifiedChat] =
    useState<TelegramVerifyResult["chat"]>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setChatId(editing?.chatId ?? "");
      setLabel(editing?.label ?? "");
      setVerifiedChat(null);
    }
  }, [open, editing]);

  const handleVerify = async () => {
    if (!bot) return;
    setVerifiedChat(null);
    try {
      const result = await onVerify(bot.id, chatId);
      setVerifiedChat(result);
    } catch (error) {
      onVerifyError(error);
    }
  };

  const handleSave = async () => {
    if (!bot) return;
    setSaving(true);
    try {
      if (editing) {
        await updateChat.mutateAsync({
          telegramChatId: editing.id,
          chatId,
          label: label || null,
        });
      } else {
        await createChat.mutateAsync({
          botId: bot.id,
          chatId,
          label: label || undefined,
        });
      }
      toast.success(t("settings:telegramUnified.toastSaved"));
      onClose();
    } catch (error) {
      onSaveError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-111.5">
        <DialogHeader>
          <DialogTitle>
            {t(
              editing
                ? "settings:telegramUnified.editChat"
                : "settings:telegramUnified.addChat",
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              editing
                ? "settings:telegramUnified.editChatDescription"
                : "settings:telegramUnified.addChatDescription",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="telegram-chat-id">
              {t("settings:telegramUnified.chatId")}
            </label>
            <Input
              id="telegram-chat-id"
              value={chatId}
              placeholder="-1001234567890"
              onChange={(event) => setChatId(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label
              className="text-xs font-medium"
              htmlFor="telegram-chat-label"
            >
              {t("settings:telegramUnified.chatLabel")}
            </label>
            <Input
              id="telegram-chat-label"
              value={label}
              placeholder={t("settings:telegramUnified.chatLabelPlaceholder")}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          {verifiedChat && (
            <p className="flex items-center gap-1.5 text-xs text-success-foreground">
              <Check className="size-3.5" />
              {t("settings:telegramUnified.verifyChatOk", {
                title: verifiedChat.title ?? "—",
                forum: verifiedChat.isForum
                  ? t("settings:telegramUnified.isForumHint")
                  : "",
              })}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!bot || !chatId || verifying}
            onClick={handleVerify}
            className="gap-2"
          >
            {verifying && <Spinner className="size-3" />}
            {t("settings:telegramUnified.verify")}
          </Button>
          <Button
            size="sm"
            disabled={!bot || !chatId || saving}
            onClick={handleSave}
            className="gap-2"
          >
            {saving && <Spinner className="size-3" />}
            {t("settings:telegramUnified.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddRulesDialog({
  chat,
  onClose,
}: {
  chat: TelegramConfigChat | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: workspacesData } = useGetWorkspaces();
  const workspaces = workspacesData ?? [];
  const createRules = useCreateTelegramConfigRules();
  const { mutateAsync: discoverTopics } = useDiscoverTelegramTopics();
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<Set<string>>(
    new Set(),
  );
  const [selection, setSelection] = useState<
    Record<string, WorkspaceSelection>
  >({});
  const [threadId, setThreadId] = useState("");
  const [detectedTopics, setDetectedTopics] = useState<TelegramTopic[]>([]);
  const [saving, setSaving] = useState(false);

  const open = Boolean(chat);
  const chatId = chat?.id;

  useEffect(() => {
    if (open) {
      setSelectedWorkspaces(new Set());
      setSelection({});
      setThreadId("");
      setDetectedTopics([]);
    }
  }, [open]);

  // Live topic detection: while the dialog is open, poll the bot's recent
  // updates; a message posted inside a forum topic makes it appear here.
  // mutateAsync is stable, and chat objects are recreated on every config
  // refresh — keying on chat.id keeps this effect from re-firing (and
  // re-polling) on every render. Consecutive failures stop the poll, e.g.
  // when the bot is consumed by a webhook or another long-polling process
  // (Telegram answers 409/400 for as long as that holds).
  useEffect(() => {
    if (!open || !chatId) return;
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const { topics } = await discoverTopics(chatId);
        if (!cancelled) {
          failures = 0;
          setDetectedTopics(topics ?? []);
        }
      } catch {
        // Best effort: suggestions are optional and the manual input keeps
        // working; a bot consumed elsewhere fails permanently, so stop
        // after a few tries instead of flooding.
        failures += 1;
        if (failures >= 5) stop();
      } finally {
        inFlight = false;
      }
    };

    void poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, chatId, discoverTopics]);

  const allSelected =
    workspaces.length > 0 &&
    workspaces.every((workspace) => selectedWorkspaces.has(workspace.id));

  const toggleWorkspace = (workspaceId: string, checked: boolean) => {
    setSelectedWorkspaces((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(workspaceId);
      } else {
        next.delete(workspaceId);
      }
      return next;
    });
    setSelection((previous) => {
      const next = { ...previous };
      if (checked && !next[workspaceId]) {
        // A freshly selected workspace defaults to routing all its projects.
        next[workspaceId] = { all: true, projectIds: new Set() };
      }
      if (!checked) {
        delete next[workspaceId];
      }
      return next;
    });
  };

  const toggleAllWorkspaces = (checked: boolean) => {
    if (checked) {
      setSelectedWorkspaces(
        new Set(workspaces.map((workspace) => workspace.id)),
      );
      setSelection((previous) => {
        const next = { ...previous };
        for (const workspace of workspaces) {
          if (!next[workspace.id]) {
            next[workspace.id] = { all: true, projectIds: new Set() };
          }
        }
        return next;
      });
    } else {
      setSelectedWorkspaces(new Set());
      setSelection({});
    }
  };

  const setWorkspaceSelection = (
    workspaceId: string,
    update: Partial<WorkspaceSelection>,
  ) => {
    setSelection((previous) => ({
      ...previous,
      [workspaceId]: {
        all: false,
        projectIds: new Set(),
        ...previous[workspaceId],
        ...update,
      },
    }));
  };

  const buildScopes = (): TelegramRuleScope[] | null => {
    const scopes: TelegramRuleScope[] = [];
    for (const workspaceId of selectedWorkspaces) {
      const current = selection[workspaceId];
      if (!current) continue;
      if (current.all) {
        scopes.push({ workspaceId, projectIds: null });
      } else if (current.projectIds.size > 0) {
        scopes.push({
          workspaceId,
          projectIds: [...current.projectIds],
        });
      } else {
        // Selected with neither "all projects" nor a project picked.
        return null;
      }
    }
    return scopes.length > 0 ? scopes : null;
  };

  const handleSave = async () => {
    if (!chat) return;
    const scopes = buildScopes();
    if (!scopes) {
      toast.error(t("settings:telegramUnified.scopeIncomplete"));
      return;
    }
    setSaving(true);
    try {
      await createRules.mutateAsync({
        telegramChatId: chat.id,
        scopes,
        threadId: threadId ? Number(threadId) : null,
      });
      toast.success(t("settings:telegramUnified.toastSaved"));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const invalidScope = [...selectedWorkspaces].some((workspaceId) => {
    const current = selection[workspaceId];
    return !current || (!current.all && current.projectIds.size === 0);
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-130">
        <DialogHeader>
          <DialogTitle>{t("settings:telegramUnified.addRule")}</DialogTitle>
          <DialogDescription>
            {t("settings:telegramUnified.addRuleDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-4 overflow-y-auto px-6 py-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">
              {t("settings:telegramUnified.ruleWorkspaces")}
            </p>
            <label
              htmlFor="telegram-rule-all-workspaces"
              className="flex items-center gap-2 text-sm"
            >
              <Checkbox
                id="telegram-rule-all-workspaces"
                checked={allSelected}
                onCheckedChange={(checked) =>
                  toggleAllWorkspaces(checked === true)
                }
              />
              {t("settings:telegramUnified.allWorkspaces")}
            </label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/50 p-2">
              {workspaces.map((workspace) => (
                <label
                  key={workspace.id}
                  htmlFor={`telegram-rule-ws-${workspace.id}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`telegram-rule-ws-${workspace.id}`}
                    checked={selectedWorkspaces.has(workspace.id)}
                    onCheckedChange={(checked) =>
                      toggleWorkspace(workspace.id, checked === true)
                    }
                  />
                  <span className="truncate">{workspace.name}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedWorkspaces.size > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">
                {t("settings:telegramUnified.ruleProjects")}
              </p>
              {[...selectedWorkspaces].map((workspaceId) => {
                const workspace = workspaces.find(
                  (candidate) => candidate.id === workspaceId,
                );
                if (!workspace) return null;
                return (
                  <WorkspaceProjectPicker
                    key={workspaceId}
                    workspaceId={workspace.id}
                    workspaceName={workspace.name}
                    selection={
                      selection[workspaceId] ?? {
                        all: true,
                        projectIds: new Set(),
                      }
                    }
                    onChange={(update) =>
                      setWorkspaceSelection(workspace.id, update)
                    }
                  />
                );
              })}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              className="text-xs font-medium"
              htmlFor="telegram-rule-topic"
            >
              {t("settings:telegramUnified.topicId")}
            </label>
            {detectedTopics.length > 0 && (
              <Select
                value={
                  detectedTopics.some((topic) => String(topic.id) === threadId)
                    ? threadId
                    : undefined
                }
                onValueChange={(value) => setThreadId(String(value ?? ""))}
              >
                <SelectTrigger
                  className="h-8 w-full"
                  aria-label={t("settings:telegramUnified.detectedTopicsLabel")}
                >
                  <SelectValue>
                    {threadId
                      ? `#${threadId}`
                      : t("settings:telegramUnified.detectedTopics", {
                          count: detectedTopics.length,
                        })}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {detectedTopics.map((topic) => (
                    <SelectItem
                      key={topic.id}
                      value={String(topic.id)}
                      className="text-xs"
                    >
                      {`${topic.title} (${topic.id})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input
              id="telegram-rule-topic"
              type="number"
              min={1}
              value={threadId}
              placeholder={t("settings:telegramUnified.topicIdPlaceholder")}
              onChange={(event) => setThreadId(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings:telegramUnified.topicHint")}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            size="sm"
            disabled={saving || invalidScope || selectedWorkspaces.size === 0}
            onClick={handleSave}
            className="gap-2"
          >
            {saving && <Spinner className="size-3" />}
            {t("settings:telegramUnified.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceProjectPicker({
  workspaceId,
  workspaceName,
  selection,
  onChange,
}: {
  workspaceId: string;
  workspaceName: string;
  selection: WorkspaceSelection;
  onChange: (update: Partial<WorkspaceSelection>) => void;
}) {
  const { t } = useTranslation();
  const { data: projectsData, isLoading } = useGetProjects({ workspaceId });
  const projects = projectsData ?? [];

  return (
    <div className="rounded-md border border-border/50 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{workspaceName}</p>
        <label
          htmlFor={`telegram-rule-all-projects-${workspaceId}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Checkbox
            id={`telegram-rule-all-projects-${workspaceId}`}
            checked={selection.all}
            onCheckedChange={(checked) => onChange({ all: checked === true })}
          />
          {t("settings:telegramUnified.allProjects")}
        </label>
      </div>
      {!selection.all && (
        <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
          {isLoading ? (
            <Spinner className="size-3.5" />
          ) : (
            projects.map((project) => (
              <label
                key={project.id}
                htmlFor={`telegram-rule-project-${project.id}`}
                className="flex items-center gap-2 text-xs"
              >
                <Checkbox
                  id={`telegram-rule-project-${project.id}`}
                  checked={selection.projectIds.has(project.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selection.projectIds);
                    if (checked === true) {
                      next.add(project.id);
                    } else {
                      next.delete(project.id);
                    }
                    onChange({ projectIds: next });
                  }}
                />
                <span className="truncate">{project.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
