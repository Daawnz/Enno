import { beforeEach, describe, expect, it, vi } from "vitest";

const { chromeMock } = vi.hoisted(() => {
  return {
    chromeMock: {
      i18n: { getUILanguage: vi.fn(() => "en-US") },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => {}),
        },
      },
    },
  };
});

vi.mock("../browser", () => ({ browser: chromeMock }));

describe("i18n adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.i18n.getUILanguage.mockReturnValue("en-US");
    chromeMock.storage.local.get.mockResolvedValue({});
  });

  it("negotiates regional variants to the closest shipped locale", async () => {
    const { negotiateLocale } = await import("../../../common/i18n/locales.js");

    expect(negotiateLocale("es-419")).toBe("es-ES");
    expect(negotiateLocale("fr-CA")).toBe("fr-FR");
    expect(negotiateLocale("pt-BR")).toBe("pt-PT");
    expect(negotiateLocale("de-AT")).toBe("de-DE");
    expect(negotiateLocale("zz")).toBe("en");
  });

  it("falls back to the browser UI language when no override is stored", async () => {
    chromeMock.i18n.getUILanguage.mockReturnValue("fr-FR");
    const { getCurrentLocale, initLocale } = await import("./i18n.js");

    await initLocale();

    expect(getCurrentLocale()).toBe("fr-FR");
  });

  it("prefers a persisted override over the UI language", async () => {
    chromeMock.i18n.getUILanguage.mockReturnValue("fr-FR");
    chromeMock.storage.local.get.mockResolvedValue({ locale: "de-DE" });
    const { getCurrentLocale, initLocale } = await import("./i18n.js");

    await initLocale();

    expect(getCurrentLocale()).toBe("de-DE");
  });

  it("setLocale persists the choice and applies it in place", async () => {
    const { getCurrentLocale, initLocale } = await import("./i18n.js");
    const { setLocale } = await import("../../../common/i18n/generated/runtime.js");

    await initLocale();
    setLocale("it-IT", { reload: false });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ locale: "it-IT" });
    expect(getCurrentLocale()).toBe("it-IT");
  });
});
