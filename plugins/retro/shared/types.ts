/** The phases a retro moves through, in order. */
export enum RetroPhase {
  Brainstorm = "brainstorm",
  Vote = "vote",
  Discuss = "discuss",
  Closed = "closed",
}

/** The order in which phases are presented and advanced. */
export const RetroPhaseOrder: RetroPhase[] = [
  RetroPhase.Brainstorm,
  RetroPhase.Vote,
  RetroPhase.Discuss,
  RetroPhase.Closed,
];

/** A column on a retro board that cards are added to. */
export interface RetroColumn {
  /** A stable identifier for the column within the retro. */
  id: string;
  /** The display title of the column. */
  title: string;
}

/** The socket event emitted to team members when a retro changes. */
export const RetroUpdateEvent = "retros.update";

/** The payload of the socket event emitted when a retro changes. */
export interface RetroUpdatePayload {
  /** The id of the retro that changed. */
  retroId: string;
}

/** Validation limits shared between the client and server. */
export const RetroValidation = {
  maxTitleLength: 255,
  maxCardLength: 1000,
  maxActionLength: 1000,
  maxColumns: 6,
  maxColumnTitleLength: 100,
  minVotesPerUser: 1,
  maxVotesPerUser: 20,
};

/** The columns used when a retro is created without explicit columns. */
export const DefaultRetroColumns: RetroColumn[] = [
  { id: "went-well", title: "Went well" },
  { id: "to-improve", title: "To improve" },
  { id: "ideas", title: "Ideas" },
];
