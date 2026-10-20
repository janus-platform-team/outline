import { observer } from "mobx-react";
import { PlusIcon } from "outline-icons";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { s } from "@shared/styles";
import { Action } from "~/components/Actions";
import Badge from "~/components/Badge";
import Button from "~/components/Button";
import Empty from "~/components/Empty";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import Time from "~/components/Time";
import useStores from "~/hooks/useStores";
import { RetroPhase } from "../../shared/types";
import { retroStore } from "../RetroStore";
import { RetroIcon } from "../Icon";
import { NewRetroForm } from "../components/NewRetroForm";
import { usePhaseLabel } from "../components/PhaseBar";

function RetroList() {
  const { t } = useTranslation();
  const { dialogs, collections } = useStores();
  const phaseLabel = usePhaseLabel();

  useEffect(() => {
    void retroStore.fetchList();
    void collections.fetchAllIfNeeded();
  }, [collections]);

  const handleNewRetro = useCallback(() => {
    dialogs.openModal({
      title: t("New retro"),
      content: <NewRetroForm onSubmit={dialogs.closeAllModals} />,
    });
  }, [dialogs, t]);

  const retros = retroStore.orderedSummaries;

  return (
    <Scene
      icon={<RetroIcon />}
      title={t("Retros")}
      actions={
        <Action>
          <Button icon={<PlusIcon />} onClick={handleNewRetro}>
            {t("New retro")}
          </Button>
        </Action>
      }
    >
      <Heading>{t("Retros")}</Heading>
      <Text as="p" type="secondary">
        {t(
          "Run retrospectives with your team. Brainstorm privately, vote on what matters, and publish a summary with action items."
        )}
      </Text>
      {retroStore.isLoaded && retros.length === 0 && (
        <Empty>{t("No retros yet. Start one to get going.")}</Empty>
      )}
      <List>
        {retros.map((retro) => (
          <li key={retro.id}>
            <Row to={`/retros/${retro.id}`}>
              <Flex column gap={2}>
                <Text weight="bold">{retro.title}</Text>
                <Text type="tertiary" size="small">
                  <Time dateTime={retro.createdAt} addSuffix />
                </Text>
              </Flex>
              <Badge primary={retro.phase !== RetroPhase.Closed}>
                {phaseLabel(retro.phase)}
              </Badge>
            </Row>
          </li>
        ))}
      </List>
    </Scene>
  );
}

const List = styled.ul`
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
`;

const Row = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 8px;
  border-radius: 8px;
  color: ${s("text")};

  &:hover,
  &:focus-visible {
    background: ${s("listItemHoverBackground")};
  }
`;

export default observer(RetroList);
