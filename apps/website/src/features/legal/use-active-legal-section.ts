import { useEffect, useState } from "react";

const noSections: ReadonlyArray<{ id: string }> = [];

/** Track the reading position, not just the last link clicked in the index. */
export const useActiveLegalSection = (sections: ReadonlyArray<{ id: string }> = noSections) => {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0]?.id;
      for (const section of sections) {
        if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= 128) {
          current = section.id;
        }
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [sections]);
  return activeId;
};
