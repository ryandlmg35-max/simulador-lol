import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ALL_LEAGUES,
  acceptIncomingOffer,
  advanceCareerRound,
  createNewManagerCareer,
  executeTransferAttempt,
  firePlayer,
  fireStaffMember,
  hireStaffMember,
  loadManagerCareer,
  rejectIncomingOffer,
  saveManagerCareer,
  selectSponsorContract,
  startNextCareerSplit,
  toggleStarterStatus,
  type ManagerCareerState,
  type NewCareerConfig,
} from "@/lib/lol/manager-career";
import { ManagerSetupWizard } from "@/components/manager/ManagerSetupWizard";
import { ManagerDashboard } from "@/components/manager/ManagerDashboard";

export const Route = createFileRoute("/manager")({
  component: ManagerCareerPage,
});

function ManagerCareerPage() {
  const [hydrated, setHydrated] = useState(false);
  const [career, setCareer] = useState<ManagerCareerState | null>(null);

  useEffect(() => {
    setCareer(loadManagerCareer());
    setHydrated(true);
  }, []);

  const commit = (updater: (prev: ManagerCareerState) => ManagerCareerState) => {
    setCareer((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      saveManagerCareer(next);
      return next;
    });
  };

  const handleStartCareer = (config: NewCareerConfig) => {
    const fresh = createNewManagerCareer(config);
    saveManagerCareer(fresh);
    setCareer(fresh);
  };

  const handleResetCareer = () => {
    saveManagerCareer(null);
    setCareer(null);
  };

  const handleSimulateUntilStageEnd = () => {
    commit((prev) => {
      let cur = prev;
      const startStage = cur.international?.active
        ? "intl"
        : cur.leagues[cur.userLeague].stage;

      for (let guard = 0; guard < 30; guard++) {
        const isDone =
          ALL_LEAGUES.every((l) => cur.leagues[l].stage === "completed") &&
          (!cur.international || cur.international.completed);
        if (isDone) break;

        if (startStage === "intl") {
          if (cur.international?.completed) break;
        } else {
          if (cur.leagues[cur.userLeague].stage !== startStage) break;
        }
        cur = advanceCareerRound(cur);
      }
      return cur;
    });
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-xs uppercase tracking-widest text-gold">
        Carregando escritório do Manager...
      </div>
    );
  }

  if (!career) {
    return <ManagerSetupWizard onStartCareer={handleStartCareer} />;
  }

  return (
    <ManagerDashboard
      state={career}
      onAdvanceRound={(forcedResult) =>
        commit((prev) => advanceCareerRound(prev, forcedResult))
      }
      onSimulateUntilStageEnd={handleSimulateUntilStageEnd}
      onStartNextSplit={() => commit((prev) => startNextCareerSplit(prev))}
      onFirePlayer={(playerId) => commit((prev) => firePlayer(prev, playerId))}
      onToggleStarter={(playerId) =>
        commit((prev) => toggleStarterStatus(prev, playerId))
      }
      onHireStaff={(staffId) => commit((prev) => hireStaffMember(prev, staffId))}
      onFireStaff={(staffId) => commit((prev) => fireStaffMember(prev, staffId))}
      onSelectSponsor={(sponsorId) =>
        commit((prev) => selectSponsorContract(prev, sponsorId))
      }
      onAcceptIncomingOffer={(offerId) =>
        commit((prev) => acceptIncomingOffer(prev, offerId))
      }
      onRejectIncomingOffer={(offerId, giveRetentionBonus) =>
        commit((prev) => rejectIncomingOffer(prev, offerId, giveRetentionBonus))
      }
      onSubmitTransfer={(params) => {
        const { nextState, evalResult } = executeTransferAttempt(career, params);
        if (nextState !== career) {
          saveManagerCareer(nextState);
          setCareer(nextState);
        }
        return evalResult;
      }}
      onResetCareer={handleResetCareer}
    />
  );
}
