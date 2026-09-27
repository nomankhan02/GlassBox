import { Fragment, type ReactNode } from "react";

/*
  Prose carries exactly one piece of markup, and only one: a figure. A number
  that is data is written between double braces in lib/ and rendered here in the
  instrument face, tabular and aligned, so a measurement never reads as part of
  the sentence around it.

  The marker is deliberate rather than automatic. A number is only treated as
  data when whoever wrote the copy decided it was, which keeps the treatment
  honest: "five steps" in a list stays a word, and a threshold that a real
  service enforces does not.
*/
export function Prose({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  /* A fresh regex per call: a module-level /g regex carries mutable lastIndex
     state across renders, which is both a lint error and a real hazard. */
  const figure = /\{\{([^}]+)\}\}/g;
  let match = figure.exec(text);
  while (match !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <span key={`${match.index}-${match[1]}`} className="readout">
        {match[1]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
    match = figure.exec(text);
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}
