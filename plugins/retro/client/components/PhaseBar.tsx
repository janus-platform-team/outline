import { CheckmarkIcon } from "outline-icons";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Flex from "~/components/Flex";
import { RetroPhase, RetroPhaseOrder } from "../../shared/types";

interface Props {
  /** The current phase of the retro. */
  phase: RetroPhase;
}

/**
 * Displays the phases of a retro with the current phase highlighted.
 */
export function PhaseBar({ phase }: Props) {
  const { t } = useTranslation();
  const phaseLabel = usePhaseLabel();
  const currentIndex = RetroPhaseOrder.indexOf(phase);

  return (
    <Steps aria-label={t("Retro phases")}>
      {RetroPhaseOrder.map((step, index) => (
        <Step
          key={step}
          $active={index === currentIndex}
          $done={index < currentIndex}
          aria-current={index === currentIndex ? "step" : undefined}
        >
          {index < currentIndex && <CheckmarkIcon size={16} />}
          {phaseLabel(step)}
        </Step>
      ))}
    </Steps>
  );
}

/**
 * Returns a function that translates a retro phase into a display label.
 *
 * @returns the label function.
 */
export function usePhaseLabel() {
  const { t } = useTranslation();

  return useCallback(
    (phase: RetroPhase) => {
      switch (phase) {
        case RetroPhase.Brainstorm:
          return t("Brainstorm");
        case RetroPhase.Vote:
          return t("Vote");
        case RetroPhase.Discuss:
          return t("Discuss");
        case RetroPhase.Closed:
          return t("Closed");
      }
    },
    [t]
  );
}

const Steps = styled(Flex).attrs({ as: "ol", gap: 4, wrap: true })`
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
`;

const Step = styled.li<{ $active: boolean; $done: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  color: ${(props) =>
    props.$active
      ? props.theme.accentText
      : props.$done
        ? props.theme.text
        : props.theme.textTertiary};
  background: ${(props) =>
    props.$active ? props.theme.accent : props.theme.backgroundSecondary};

  svg {
    fill: currentColor;
  }
`;
