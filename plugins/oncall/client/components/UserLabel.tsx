import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { Avatar, AvatarSize } from "~/components/Avatar";
import useStores from "~/hooks/useStores";

interface Props {
  /** The id of the user to display, or null for nobody. */
  userId: string | null;
  /** The size of the avatar. */
  size?: AvatarSize;
  /** Whether to hide the name and only show the avatar. */
  avatarOnly?: boolean;
}

/**
 * Displays a user's avatar and name.
 */
export const UserLabel = observer(function UserLabel({
  userId,
  size = AvatarSize.Small,
  avatarOnly,
}: Props) {
  const { t } = useTranslation();
  const { users } = useStores();
  const user = userId ? users.get(userId) : undefined;

  if (!userId) {
    return <Name>{t("Nobody")}</Name>;
  }

  return (
    <Wrapper>
      {user && <Avatar model={user} size={size} showHoverCard={false} />}
      {!avatarOnly && <Name>{user?.name ?? t("Unknown")}</Name>}
    </Wrapper>
  );
});

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
