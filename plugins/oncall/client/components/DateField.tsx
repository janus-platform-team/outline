import { useId } from "react";
import styled from "styled-components";
import { s } from "@shared/styles";
import { LabelText } from "~/components/Input";
import type { DateString } from "../../shared/types";

interface Props {
  /** The label shown above the field. */
  label: string;
  /** The selected date. */
  value: DateString;
  /** The earliest date that can be selected. */
  min?: DateString;
  /** Called with the new date when it changes. */
  onChange: (value: DateString) => void;
  /** Whether the field is disabled. */
  disabled?: boolean;
}

/**
 * A labelled native date picker.
 */
export function DateField({ label, value, min, onChange, disabled }: Props) {
  const id = useId();

  return (
    <Wrapper>
      <label htmlFor={id}>
        <LabelText>{label}</LabelText>
      </label>
      <NativeInput
        id={id}
        type="date"
        value={value}
        min={min}
        disabled={disabled}
        required
        onChange={(ev) => {
          if (ev.target.value) {
            onChange(ev.target.value);
          }
        }}
      />
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  margin: 0 0 16px;
  flex: 1;
`;

const NativeInput = styled.input`
  font: inherit;
  font-size: 15px;
  padding: 6px 8px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  background: ${s("background")};
  color: ${s("text")};
  color-scheme: ${(props) => (props.theme.isDark ? "dark" : "light")};

  &:focus {
    outline: none;
    border-color: ${s("inputBorderFocused")};
  }
`;
