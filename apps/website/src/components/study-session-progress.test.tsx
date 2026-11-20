import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StudySessionProgress } from "./study-session-progress.tsx";

it("exposes the session count as a labelled progress bar", () => {
  const markup = renderToStaticMarkup(
    <StudySessionProgress completed={17} total={100} label="Revisões" />,
  );
  expect(markup).toContain('aria-label="Revisões"');
  expect(markup).toContain('aria-valuenow="17"');
  expect(markup).toContain('aria-valuemax="100"');
});

it("keeps empty and completed sessions in range", () => {
  const empty = renderToStaticMarkup(
    <StudySessionProgress completed={-1} total={0} label="Revisões" />,
  );
  expect(empty).toContain('aria-valuenow="0"');
  const finished = renderToStaticMarkup(
    <StudySessionProgress completed={9} total={3} label="Revisões" />,
  );
  expect(finished).toContain('aria-valuenow="3"');
});
