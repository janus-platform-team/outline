import { observer } from "mobx-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import type { Option } from "~/components/InputSelect";
import { InputSelect } from "~/components/InputSelect";
import Switch from "~/components/Switch";
import useStores from "~/hooks/useStores";
import { DefaultRetroColumns, RetroValidation } from "../../shared/types";
import { retroStore } from "../RetroStore";

interface Props {
  /** Called once the retro has been created. */
  onSubmit: () => void;
}

/**
 * The form used to create a new retro.
 */
export const NewRetroForm = observer(function NewRetroForm({
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const history = useHistory();
  const { collections, policies } = useStores();
  const [title, setTitle] = useState("");
  const [columns, setColumns] = useState(() =>
    DefaultRetroColumns.map((column) => column.title).join("\n")
  );
  const [anonymous, setAnonymous] = useState(true);
  const [votesPerUser, setVotesPerUser] = useState(5);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const columnTitles = columns
    .split("\n")
    .map((column) => column.trim())
    .filter(Boolean);

  const isValid =
    title.trim().length > 0 &&
    columnTitles.length > 0 &&
    columnTitles.length <= RetroValidation.maxColumns;

  const handleSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setIsSaving(true);

      try {
        const retro = await retroStore.create({
          title: title.trim(),
          columns: columnTitles,
          anonymous,
          votesPerUser,
          collectionId,
        });
        onSubmit();
        history.push(`/retros/${retro.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setIsSaving(false);
      }
    },
    [
      anonymous,
      collectionId,
      columnTitles,
      history,
      onSubmit,
      title,
      votesPerUser,
    ]
  );

  return (
    <form onSubmit={handleSubmit}>
      <Input
        label={t("Title")}
        placeholder={t("Sprint 42 retro")}
        value={title}
        maxLength={RetroValidation.maxTitleLength}
        onChange={(ev) => setTitle(ev.target.value)}
        autoFocus
        required
      />
      <Input
        type="textarea"
        label={t("Columns, one per line")}
        value={columns}
        onChange={(ev) => setColumns(ev.target.value)}
        error={
          columnTitles.length > RetroValidation.maxColumns
            ? t("A retro can have at most {{ count }} columns", {
                count: RetroValidation.maxColumns,
              })
            : undefined
        }
        rows={4}
      />
      <Input
        label={t("Votes per person")}
        type="text"
        inputMode="numeric"
        value={String(votesPerUser)}
        onChange={(ev) => {
          const value = parseInt(ev.target.value, 10);
          setVotesPerUser(
            Number.isNaN(value)
              ? RetroValidation.minVotesPerUser
              : Math.min(
                  RetroValidation.maxVotesPerUser,
                  Math.max(RetroValidation.minVotesPerUser, value)
                )
          );
        }}
      />
      <InputSelect
        label={t("Publish summary to")}
        options={collectionOptions}
        value={collectionId}
        onChange={setCollectionId}
        help={t("The summary document is created here when the retro closes.")}
      />
      <SwitchRow>
        <Switch
          label={t("Anonymous cards")}
          note={t("Hide who wrote each card, including from the facilitator.")}
          checked={anonymous}
          onChange={setAnonymous}
        />
      </SwitchRow>
      <Flex justify="flex-end">
        <Button type="submit" disabled={!isValid || isSaving}>
          {isSaving ? `${t("Creating")}…` : t("Create retro")}
        </Button>
      </Flex>
    </form>
  );
});

const SwitchRow = styled.div`
  margin: 16px 0 24px;
`;
