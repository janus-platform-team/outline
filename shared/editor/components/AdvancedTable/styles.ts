import styled, { css } from "styled-components";
import { s } from "../../../styles";

export const RowHeight = 34;

export const HeaderHeight = 36;

export const SelectionColumnWidth = 40;

export const MaxGridHeight = 480;

export const PageSize = 100;

export const Wrapper = styled.div<{ $selected: boolean }>`
  position: relative;
  margin: 0.75em 0;
  border: 1px solid ${s("divider")};
  border-radius: 6px;
  background: ${s("background")};
  color: ${s("text")};
  font-size: 14px;
  line-height: 1.4;
  white-space: normal;
  overflow: hidden;
  user-select: none;

  ${(props) =>
    props.$selected &&
    css`
      box-shadow: 0 0 0 2px ${s("selected")};
    `}
`;

export const Scroller = styled.div`
  position: relative;
  overflow: auto;
  max-height: ${MaxGridHeight}px;
  outline: none;
  overscroll-behavior: contain;
`;

export const HeaderRow = styled.div`
  display: flex;
  position: sticky;
  top: 0;
  z-index: 3;
  height: ${HeaderHeight}px;
  border-bottom: 1px solid ${s("divider")};
  background: ${s("backgroundSecondary")};
`;

export const Body = styled.div`
  position: relative;
`;

export const Row = styled.div<{ $selected: boolean }>`
  display: flex;
  position: absolute;
  left: 0;
  top: 0;
  height: ${RowHeight}px;
  border-bottom: 1px solid ${s("divider")};
  box-sizing: border-box;

  > div {
    ${(props) =>
      props.$selected &&
      css`
        background-image: linear-gradient(
          ${s("tableSelectedBackground")},
          ${s("tableSelectedBackground")}
        );
      `}
  }

  &:hover > div {
    background-image: linear-gradient(
      ${s("listItemHoverBackground")},
      ${s("listItemHoverBackground")}
    );
  }
`;

export const CellBox = styled.div<{
  $align?: "left" | "right" | "center";
  $active?: boolean;
  $pinned?: boolean;
}>`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: ${(props) =>
    props.$align === "right"
      ? "flex-end"
      : props.$align === "center"
        ? "center"
        : "flex-start"};
  height: 100%;
  padding: 0 8px;
  box-sizing: border-box;
  border-right: 1px solid ${s("divider")};
  background-color: ${s("background")};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: default;

  ${(props) =>
    props.$pinned &&
    css`
      position: sticky;
      z-index: 1;
    `}

  ${(props) =>
    props.$active &&
    css`
      box-shadow: inset 0 0 0 2px ${s("accent")};
    `}
`;

export const CellText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const HeaderBox = styled(CellBox)`
  position: relative;
  gap: 4px;
  padding-right: 10px;
  font-weight: 500;
  background-color: ${s("backgroundSecondary")};
  color: ${s("textSecondary")};
  cursor: pointer;

  ${(props) =>
    props.$pinned &&
    css`
      position: sticky;
      z-index: 2;
    `}
`;

export const HeaderLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ResizeHandle = styled.div<{ $active: boolean }>`
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  z-index: 2;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 3px;
    height: 100%;
    background: ${(props) =>
      props.$active ? props.theme.accent : "transparent"};
  }

  &:hover::after {
    background: ${s("accent")};
  }
`;

export const DropIndicator = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: ${s("accent")};
  z-index: 4;
  pointer-events: none;
`;

export const IconButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${(props) =>
    props.$active ? props.theme.accent : props.theme.textTertiary};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${s("listItemHoverBackground")};
    color: ${s("text")};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  svg {
    flex: none;
  }
`;

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid ${s("divider")};
  color: ${s("textSecondary")};
`;

export const ToolbarSpacer = styled.div`
  flex: 1;
`;

export const ToolbarButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 8px 0 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${s("textSecondary")};
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${s("listItemHoverBackground")};
    color: ${s("text")};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const SearchInput = styled.input`
  height: 28px;
  width: 180px;
  padding: 0 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: ${s("accent")};
  }
`;

export const Status = styled.span`
  font-size: 12px;
  color: ${s("textTertiary")};
  white-space: nowrap;
  padding: 0 4px;
`;

export const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 4px 8px;
  border-top: 1px solid ${s("divider")};
  color: ${s("textTertiary")};
  font-size: 12px;
`;

export const EditorInput = styled.input`
  width: 100%;
  height: 100%;
  margin: 0 -8px;
  padding: 0 8px;
  border: 0;
  outline: none;
  background: ${s("background")};
  color: ${s("text")};
  font: inherit;
  box-shadow: inset 0 0 0 2px ${s("accent")};
  box-sizing: content-box;
`;

export const Checkbox = styled.input`
  margin: 0;
  cursor: pointer;
  accent-color: ${s("accent")};
`;

export const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${s("textTertiary")};
`;

export const PopoverBox = styled.div`
  position: fixed;
  z-index: 3000;
  min-width: 200px;
  max-width: 280px;
  max-height: 420px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 6px;
  background: ${s("menuBackground")};
  box-shadow: ${s("menuShadow")};
  color: ${s("text")};
  font-size: 13px;
  white-space: normal;
  user-select: none;
`;

export const MenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: ${(props) => (props.$danger ? props.theme.danger : props.theme.text)};
  font-size: 13px;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled),
  &:focus-visible {
    background: ${s("listItemHoverBackground")};
    outline: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

export const MenuSeparator = styled.hr`
  margin: 4px 0;
  border: 0;
  border-top: 1px solid ${s("divider")};
`;

export const MenuLabel = styled.label`
  display: block;
  padding: 4px 8px 2px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  color: ${s("textTertiary")};
`;

export const MenuField = styled.div`
  padding: 2px 8px 6px;

  input,
  select {
    width: 100%;
    height: 28px;
    padding: 0 6px;
    border: 1px solid ${s("inputBorder")};
    border-radius: 4px;
    background: ${s("background")};
    color: ${s("text")};
    font-size: 13px;
    box-sizing: border-box;
    outline: none;

    &:focus {
      border-color: ${s("accent")};
    }
  }
`;

export const MenuRow = styled.div`
  display: flex;
  gap: 4px;
  padding: 0 8px 6px;
`;

export const CheckRow = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &:hover {
    background: ${s("listItemHoverBackground")};
  }
`;
