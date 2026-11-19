import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AiCreditCost } from "./ai-credit-cost.tsx";

const text = (markup: string) => markup.replace(/<[^>]+>/g, "");

describe("AiCreditCost", () => {
  it("shows the localized cost and balance in one line", () => {
    const line = text(renderToStaticMarkup(<AiCreditCost cost={1200} available={20000} />));
    expect(line).toBe("1.200 créditos · saldo 20.000");
  });

  it("distinguishes a loading balance from zero credits", () => {
    expect(text(renderToStaticMarkup(<AiCreditCost cost={10} />))).toBe("10 créditos · saldo …");
    expect(text(renderToStaticMarkup(<AiCreditCost cost={10} available={0} />))).toBe(
      "10 créditos · saldo 0",
    );
  });
});
