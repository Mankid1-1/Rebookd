import { createContext, useContext, useCallback, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { registerSkillContext } from "@/components/ui/HelpTooltip";

// ─── Types ───────────────────────────────────────────────────────────────────

type SkillLevel = "basic" | "intermediate" | "advanced";

interface SkillLevelContextValue {
  skillLevel: SkillLevel;
  isBasic: boolean;
  isIntermediate: boolean;
  isAdvanced: boolean;
  setSkillLevel: (level: SkillLevel) => Promise<void>;
  isLoading: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SkillLevelContext = createContext<SkillLevelContextValue>({
  skillLevel: "basic",
  isBasic: true,
  isIntermediate: false,
  isAdvanced: false,
  setSkillLevel: async () => {},
  isLoading: false,
});

// Register so HelpTooltip can read skill level without direct import
registerSkillContext(SkillLevelContext);

// ─── Provider ────────────────────────────────────────────────────────────────

export function SkillLevelProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.auth.getSkillLevel.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const setSkillLevelMutation = trpc.auth.setSkillLevel.useMutation({
    onSuccess: () => {
      utils.auth.getSkillLevel.invalidate();
    },
  });

  const skillLevel: SkillLevel = data?.skillLevel ?? "basic";

  const setSkillLevel = useCallback(
    async (level: SkillLevel) => {
      await setSkillLevelMutation.mutateAsync({ level });
    },
    [setSkillLevelMutation]
  );

  const value: SkillLevelContextValue = {
    skillLevel,
    isBasic: skillLevel === "basic",
    isIntermediate: skillLevel === "intermediate",
    isAdvanced: skillLevel === "advanced",
    setSkillLevel,
    isLoading,
  };

  return (
    <SkillLevelContext.Provider value={value}>
      {children}
    </SkillLevelContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSkillLevel(): SkillLevelContextValue {
  return useContext(SkillLevelContext);
}
