import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiCreditCost } from "./ai-credit-cost.tsx";

describe("AiCreditCost", () => {
  it("shows localized cost and balance with their units", () => {
    const markup = renderToStaticMarkup(<AiCreditCost cost={1200} available={20000} />);
    expect(markup).toContain("1.200");
    expect(markup).toContain("20.000");
    expect(markup.match(/créditos/g)).toHaveLength(2);
  });

  it("distinguishes a loading balance from zero credits", () => {
    expect(renderToStaticMarkup(<AiCreditCost cost={10} />)).toContain("…");
    const zero = renderToStaticMarkup(<AiCreditCost cost={10} available={0} />);
    expect(zero).not.toContain("…");
    expect(zero).toContain("Saldo: 0 créditos");
  });
});
