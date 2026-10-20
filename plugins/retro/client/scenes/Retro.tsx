import { observer } from "mobx-react";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useHistory, useParams } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Notice from "~/components/Notice";
import PlaceholderDocument from "~/components/PlaceholderDocument";
import Scene from "~/components/Scene";
import Text from "~/components/Text";
import { WebsocketContext } from "~/components/WebsocketProvider";
import useCurrentUser from "~/hooks/useCurrentUser";
import useStores from "~/hooks/useStores";
import type {
  RetroUpdatePayload,
  RetroPhase as RetroPhaseType,
} from "../../shared/types";
import {
  RetroPhase,
  RetroPhaseOrder,
  RetroUpdateEvent,
} from "../../shared/types";
import { retroStore } from "../RetroStore";
import { RetroIcon } from "../Icon";
import { ActionItems } from "../components/ActionItems";
import { Column } from "../components/Column";
import { PhaseBar, usePhaseLabel } from "../components/PhaseBar";
import type { RetroCardData } from "../types";

const EmptyCards: RetroCardData[] = [];

function showError(err: unknown) {
  toast.error(err instanceof Error ? err.message : String(err));
}

function RetroScene() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const user = useCurrentUser();
  const { users, collections, policies } = useStores();
  const socket = useContext(WebsocketContext);
  const phaseLabel = usePhaseLabel();
  const board = retroStore.boards.get(id);
  const notFound = retroStore.notFound.has(id);

  const refetch = useCallback(async () => {
    await retroStore.fetch(id).catch(showError);
  }, [id]);

  useEffect(() => {
    void refetch();
    void collections.fetchAllIfNeeded();
    void users.fetchPage({ limit: 100 });
  }, [refetch, collections, users]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleUpdate = (payload: RetroUpdatePayload) => {
      if (payload.retroId === id) {
        void refetch();
      }
    };

    socket.on(RetroUpdateEvent, handleUpdate);
    return () => {
      socket.off(RetroUpdateEvent, handleUpdate);
    };
  }, [socket, id, refetch]);

  const missingUserIds = useMemo(() => {
    if (!board) {
      return [];
    }

    const ids = new Set<string>();
    board.cards.forEach((card) => card.authorId && ids.add(card.authorId));
    board.actionItems.forEach(
      (item) => item.assigneeId && ids.add(item.assigneeId)
    );
    return [...ids].filter((userId) => !users.get(userId));
  }, [board, users]);

  useEffect(() => {
    missingUserIds.forEach((userId) => {
      void users.fetch(userId).catch(() => undefined);
    });
  }, [missingUserIds, users]);

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, RetroCardData[]>();
    board?.cards.forEach((card) => {
      map.set(card.columnId, [...(map.get(card.columnId) ?? []), card]);
    });
    return map;
  }, [board?.cards]);

  const collectionOptions: Option[] = useMemo(
    () =>
      collections.orderedData
        .filter(
          (collection) => policies.abilities(collection.id).createDocument
        )
        .map((collection) => ({
          type: "item" as const,
          label: collection.name,
          value: collection.id,
        })),
    [collections.orderedData, policies]
  );

  const handleAddCard = useCallback(
    (columnId: string, text: string) =>
      retroStore.addCard(id, columnId, text).catch(showError),
    [id]
  );

  const handleUpdateCard = useCallback(
    (cardId: string, text: string) =>
      retroStore.updateCard(cardId, text).catch(showError),
    []
  );

  const handleDeleteCard = useCallback((cardId: string) => {
    retroStore.deleteCard(cardId).catch(showError);
  }, []);

  const handleToggleVote = useCallback((cardId: string, voted: boolean) => {
    (voted ? retroStore.unvote(cardId) : retroStore.vote(cardId)).catch(
      showError
    );
  }, []);

  const handleAddAction = useCallback(
    (text: string, assigneeId: string | null) =>
      retroStore.addAction(id, text, assigneeId).catch(showError),
    [id]
  );

  const handleToggleAction = useCallback(
    (itemId: string, completed: boolean) => {
      retroStore.updateAction(itemId, { completed }).catch(showError);
    },
    []
  );

  const handleAssignAction = useCallback(
    (itemId: string, assigneeId: string | null) => {
      retroStore.updateAction(itemId, { assigneeId }).catch(showError);
    },
    []
  );

  const handleDeleteAction = useCallback((itemId: string) => {
    retroStore.deleteAction(itemId).catch(showError);
  }, []);

  const handleCollectionChange = useCallback(
    (collectionId: string) => {
      retroStore.update(id, { collectionId }).catch(showError);
    },
    [id]
  );

  const handleChangePhase = useCallback(
    async (phase: RetroPhaseType) => {
      try {
        await retroStore.update(id, { phase });
        if (phase === RetroPhase.Closed) {
          toast.success(t("Retro closed and summary published"));
        }
      } catch (err) {
        showError(err);
      }
    },
    [id, t]
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm(t("Are you sure you want to delete this retro?"))) {
      return;
    }

    try {
      await retroStore.delete(id);
      history.push("/retros");
    } catch (err) {
      showError(err);
    }
  }, [history, id, t]);

  if (!board) {
    return (
      <Scene icon={<RetroIcon />} title={t("Retro")}>
        {notFound ? (
          <Notice>{t("This retro could not be found.")}</Notice>
        ) : (
          <PlaceholderDocument />
        )}
      </Scene>
    );
  }

  const isFacilitator = board.createdById === user.id || user.isAdmin;
  const isClosed = board.phase === RetroPhase.Closed;
  const phaseIndex = RetroPhaseOrder.indexOf(board.phase);
  const previousPhase = RetroPhaseOrder[phaseIndex - 1];
  const nextPhase = RetroPhaseOrder[phaseIndex + 1];
  const canClose = nextPhase !== RetroPhase.Closed || !!board.collectionId;

  const actions =
    isFacilitator && !isClosed ? (
      <Flex gap={8}>
        {previousPhase && (
          <Button neutral onClick={() => handleChangePhase(previousPhase)}>
            {t("Back to {{ phase }}", { phase: phaseLabel(previousPhase) })}
          </Button>
        )}
        {nextPhase && (
          <Button
            disabled={!canClose}
            onClick={() => handleChangePhase(nextPhase)}
          >
            {nextPhase === RetroPhase.Closed
              ? t("Close and publish summary")
              : t("Start {{ phase }}", { phase: phaseLabel(nextPhase) })}
          </Button>
        )}
        <Button neutral danger onClick={handleDelete}>
          {t("Delete")}
        </Button>
      </Flex>
    ) : undefined;

  return (
    <Scene
      icon={<RetroIcon />}
      title={board.title}
      textTitle={board.title}
      actions={actions}
      wide
    >
      <Heading>{board.title}</Heading>
      <PhaseBar phase={board.phase} />
      <PhaseHint>
        {board.phase === RetroPhase.Brainstorm &&
          (board.hiddenCardCount > 0
            ? t(
                "Add your cards. {{ count }} cards from others are hidden until brainstorming ends.",
                { count: board.hiddenCardCount }
              )
            : t(
                "Add your cards. Cards from others are hidden until brainstorming ends."
              ))}
        {board.phase === RetroPhase.Vote &&
          t(
            "Vote for the cards you want to discuss. {{ count }} votes remaining.",
            {
              count: board.votesRemaining,
            }
          )}
        {board.phase === RetroPhase.Discuss &&
          t("Cards are sorted by votes. Record action items below.")}
        {isClosed && board.documentId && (
          <>
            {t("This retro is closed.")}{" "}
            <Link to={`/doc/${board.documentId}`}>{t("View summary")}</Link>
          </>
        )}
        {board.anonymous && <> {t("Authors are anonymous.")}</>}
      </PhaseHint>
      {isFacilitator && !isClosed && (
        <CollectionPicker align="center" gap={8}>
          <Text type="secondary" size="small">
            {t("Publish summary to")}
          </Text>
          <InputSelect
            label={t("Collection")}
            labelHidden
            short
            options={collectionOptions}
            value={board.collectionId}
            onChange={handleCollectionChange}
            displayValue={(option) => option?.label ?? t("Choose a collection")}
          />
        </CollectionPicker>
      )}
      <Columns>
        {board.columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            cards={cardsByColumn.get(column.id) ?? EmptyCards}
            canAddCards={board.phase === RetroPhase.Brainstorm}
            canVote={board.phase === RetroPhase.Vote}
            canModerate={isFacilitator && !isClosed}
            hasVotesRemaining={board.votesRemaining > 0}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onToggleVote={handleToggleVote}
          />
        ))}
      </Columns>
      <ActionItems
        items={board.actionItems}
        canEdit={!isClosed}
        onAdd={handleAddAction}
        onToggle={handleToggleAction}
        onAssign={handleAssignAction}
        onDelete={handleDeleteAction}
      />
    </Scene>
  );
}

const PhaseHint = styled(Text).attrs({ as: "p", type: "secondary" })`
  margin: 0 0 16px;
`;

const CollectionPicker = styled(Flex)`
  margin-bottom: 16px;
`;

const Columns = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-start;
  overflow-x: auto;
  padding-bottom: 8px;
`;

export default observer(RetroScene);
