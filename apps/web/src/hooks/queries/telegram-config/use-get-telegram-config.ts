import { useQuery } from "@tanstack/react-query";
import getTelegramConfig from "@/fetchers/telegram-config/get-telegram-config";

function useGetTelegramConfig() {
  return useQuery({
    queryKey: ["telegram-config"],
    queryFn: () => getTelegramConfig(),
  });
}

export default useGetTelegramConfig;
