import React, { useState, useMemo } from 'react';
import { GoalExecutionContract, GoalAdmissionResult } from '../../domain/goal/GoalExecutionContract';
import { validateGoalAdmission, computeContractHash } from '../../domain/goal/GoalAdmissionPolicy';
import { GOAL_REJECTION_MESSAGES } from '../../domain/goal/GoalRejectionCode';
import TerminalOutcomePanel from './TerminalOutcomePanel';
import SacrificeDeclarationPanel from './SacrificeDeclarationPanel';
import TemporalBindingPanel from './TemporalBindingPanel';
import CausalChainBuilder from './CausalChainBuilder';
import InscriptionPanel from './InscriptionPanel';
import ReinforcementDisclosure from './ReinforcementDisclosure';

/**
 * GoalAdmissionPage: Hard validation UI for goal contracts
 * 
 * Rules:
 * - No free-text explanations, no motivation
 * - Each section must be valid before progression
 * - "Admit Goal" calls policy validator
 * - If rejected → store in aspirations[]
 * - If admitted → create new cycle + calendar
 * - No partial goals allowed
 * - No "Save Draft"
 * 
 * This UI does not help users feel ready.
 * It determines whether they are willing to pay.
 */

interface GoalAdmissionPageProps {
  contract: GoalExecutionContract;
  onContractChange: (contract: GoalExecutionContract) => void;
  onAdmit: (result: GoalAdmissionResult) => void;
  onAspire: (notes: string) => void;
  existingGoalOutcomes?: string[];
  appTimeISO?: string;
}

export default function GoalAdmissionPage({
  contract,
  onContractChange,
  onAdmit,
  onAspire,
  existingGoalOutcomes = [],
  appTimeISO = new Date().toISOString(),
}: GoalAdmissionPageProps) {
  const [showRejectionDetail, setShowRejectionDetail] = useState(false);
  const [aspirationNotes, setAspirationNotes] = useState('');
  const disclosureAccepted = contract.commitmentDisclosureAccepted ?? false;

  // Phase 3: Mechanism class always defaults to GENERIC_DETERMINISTIC (v1 only)
  const mechanismClass = contract.planGenerationMechanismClass || 'GENERIC_DETERMINISTIC';

  const contractWithHash = useMemo(() => {
    if (!contract.inscription) return contract;
    const computedHash = computeContractHash(contract);
    if (contract.inscription.contractHash === computedHash) return contract;
    return {
      ...contract,
      inscription: {
        ...contract.inscription,
        contractHash: computedHash
      }
    };
  }, [contract]);

  React.useEffect(() => {
    if (contractWithHash !== contract) {
      onContractChange(contractWithHash);
    }
  }, [contractWithHash, contract, onContractChange]);

  // Validate contract on every change
  const validationResult = useMemo(
    () => validateGoalAdmission(contractWithHash, appTimeISO, existingGoalOutcomes),
    [contractWithHash, appTimeISO, existingGoalOutcomes]
  );

  const isAdmissible = validationResult.status === 'ADMITTED';
  const rejectionCount = validationResult.rejectionCodes.length;

  // Section validity checks
  const outcomeValid =
    contract.terminalOutcome &&
    contract.terminalOutcome.text.trim().length >= 5 &&
    contract.terminalOutcome.verificationCriteria.trim().length >= 3 &&
    contract.terminalOutcome.isConcrete;

  const deadlineValid =
    contract.deadline &&
    contract.deadline.dayKey &&
    new Date(`${contract.deadline.dayKey}T23:59:59.999Z`) > new Date(appTimeISO);

  const sacrificeValid =
    contract.sacrifice &&
    contract.sacrifice.whatIsGivenUp.trim().length >= 3 &&
    contract.sacrifice.quantifiedImpact.trim().length >= 2 &&
    !['maybe', 'might', 'could', 'possibly', 'no sacrifice'].some((p) =>
      contract.sacrifice.whatIsGivenUp.toLowerCase().includes(p)
    );

  const temporalValid =
    contract.temporalBinding &&
    Number.isInteger(contract.temporalBinding.daysPerWeek) &&
    contract.temporalBinding.daysPerWeek >= 3 &&
    contract.temporalBinding.daysPerWeek <= 7 &&
    contract.temporalBinding.activationTime &&
    contract.temporalBinding.sessionDurationMinutes >= 15;

  const causalValid =
    contract.causalChain &&
    contract.causalChain.steps &&
    contract.causalChain.steps.length >= 1;

  const reinforcementValid =
    contract.reinforcement &&
    contract.reinforcement.dailyExposureEnabled &&
    contract.reinforcement.dailyMechanism?.trim() &&
    contract.reinforcement.checkInFrequency;

  const inscriptionValid = contractWithHash.inscription && contractWithHash.inscription.contractHash;

  return (
    <div className="space-y-4">
      {/* Rejection banner (if any failures) */}
      {rejectionCount > 0 && (
        <div className="rounded-lg border border-red-600/40 bg-red-50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-red-900">
              Contract Not Admissible ({rejectionCount} {rejectionCount === 1 ? 'issue' : 'issues'})
            </p>
            <button
              className="text-xs text-red-700 hover:text-red-900 underline"
              onClick={() => setShowRejectionDetail(!showRejectionDetail)}
            >
              {showRejectionDetail ? 'Hide' : 'Show'} details
            </button>
          </div>
          {showRejectionDetail && (
            <ul className="space-y-1 text-xs text-red-800">
              {validationResult.rejectionMessages.map((msg, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-red-600">•</span>
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Admission banner (if all pass) */}
      {isAdmissible && (
        <div className="rounded-lg border border-green-600/40 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-900">Contract is admissible. No issues found.</p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {/* 0. Plan Generation Mechanism (Phase 3 Required) */}
        <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
              M
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Plan Generation Mechanism</p>
            <span className="text-[10px] text-blue-600 font-semibold">PHASE 3</span>
          </div>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Algorithm</span>
              <div className="w-full rounded border border-line/60 bg-transparent px-3 py-2 text-sm text-muted italic">
                {mechanismClass}
                <span className="text-[10px] ml-2 text-blue-600">(v1 default, locked)</span>
              </div>
            </label>
            <p className="text-[10px] text-muted">
              Phase 3 v1 supports deterministic plan generation. This cannot be changed in the current version.
            </p>
          </div>
        </div>

        {/* 1. Terminal Outcome */}
        <TerminalOutcomePanel
          outcome={contract.terminalOutcome}
          onOutcomeChange={(outcome) =>
            onContractChange({
              ...contract,
              terminalOutcome: outcome,
            })
          }
          isValid={outcomeValid}
        />

        {/* 2. Deadline */}
        <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
              2
            </span>
            <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Deadline</p>
            {deadlineValid && <span className="text-xs text-green-600">✓</span>}
          </div>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Date</span>
              <input
                type="date"
                value={contract.deadline?.dayKey || ''}
                onChange={(e) =>
                  onContractChange({
                    ...contract,
                    deadline: {
                      dayKey: e.target.value,
                      isHardDeadline: contract.deadline?.isHardDeadline ?? true,
                    },
                  })
                }
                className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={contract.deadline?.isHardDeadline ?? true}
                onChange={(e) =>
                  onContractChange({
                    ...contract,
                    deadline: {
                      dayKey: contract.deadline?.dayKey || '',
                      isHardDeadline: e.target.checked,
                    },
                  })
                }
              />
              <span>Hard deadline (no extension)</span>
            </label>
          </div>
        </div>

        {/* 3. Sacrifice Declaration */}
        <SacrificeDeclarationPanel
          sacrifice={contract.sacrifice}
          onSacrificeChange={(sacrifice) =>
            onContractChange({
              ...contract,
              sacrifice,
            })
          }
          isValid={sacrificeValid}
        />

        {/* 4. Temporal Binding */}
        <TemporalBindingPanel
          temporalBinding={contract.temporalBinding}
          onTemporalChange={(binding) =>
            onContractChange({
              ...contract,
              temporalBinding: binding,
            })
          }
          isValid={temporalValid}
        />

        {/* 5. Causal Chain */}
        <CausalChainBuilder
          causalChain={contract.causalChain}
          onCausalChange={(chain) =>
            onContractChange({
              ...contract,
              causalChain: chain,
            })
          }
          isValid={causalValid}
        />

        {/* 6. Reinforcement Disclosure */}
        <ReinforcementDisclosure
          reinforcement={contract.reinforcement}
          onReinforcementChange={(reinforcement) =>
            onContractChange({
              ...contract,
              reinforcement,
            })
          }
          isValid={reinforcementValid}
        />

        {/* 7. Inscription (immutability) */}
        <InscriptionPanel
          inscription={contract.inscription}
          onInscriptionChange={(inscription) =>
            onContractChange({
              ...contract,
              inscription,
            })
          }
          isValid={inscriptionValid}
        />
      </div>

      <div className="flex items-start gap-3 text-xs text-muted/90 border rounded-lg border-line/60 bg-jericho-surface/90 p-3">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={disclosureAccepted}
            onChange={(e) => {
              onContractChange({
                ...contract,
                commitmentDisclosureAccepted: e.target.checked,
                commitmentDisclosureAcceptedAtISO: e.target.checked ? new Date().toISOString() : undefined,
              });
            }}
          />
        </label>
        <p>
          I understand this goal equation is immutable once admitted. I may only change start date or deadline. Any other change requires starting a new cycle.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-4 border-t border-line/60">
        <div className="text-[11px] text-muted/80">
          {disclosureAccepted ? 'Disclosure accepted' : 'Disclosure required before admission'}
        </div>
        <div className="flex-1" />
        {isAdmissible ? (
          <button
            className="flex-1 rounded-lg border border-green-600 bg-green-600 text-white px-4 py-2 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onAdmit(validationResult)}
            disabled={!disclosureAccepted}
          >
            Admit Goal to Calendar
          </button>
        ) : (
          <button
            className="flex-1 rounded-lg border border-line/60 bg-jericho-surface/50 text-muted px-4 py-2 text-sm font-semibold opacity-50 cursor-not-allowed"
            disabled
          >
            (Fix issues to admit)
          </button>
        )}

        <button
          className="rounded-lg border border-line/60 px-4 py-2 text-xs text-muted hover:text-jericho-accent"
          onClick={() => {
            const notes = window.prompt('Why are you setting this aside as an aspiration?');
            if (notes !== null) {
              onAspire(notes);
            }
          }}
        >
          Mark as aspiration
        </button>
      </div>
    </div>
  );
}
