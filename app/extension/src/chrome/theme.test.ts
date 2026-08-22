import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyThemePreferenceToDocument,
  applyThemePreferenceToIcon,
  effectiveDark,
  initPageTheme,
  readThemePreference,
  THEME_PREFERENCE_STORAGE_KEY,
  writeThemePreference,
} from "./theme";

const { chromeMock } = vi.hoisted(() => {
  return {
    chromeMock: {
      action: {
        setIcon: vi.fn(async () => {}),
      },
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => {}),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
      runtime: {},
    },
  };
});

vi.mock("../browser", () => ({ browser: chromeMock }));

describe("theme preference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.storage.local.get.mockResolvedValue({});
    chromeMock.storage.local.set.mockResolvedValue(undefined);
  });

  it("maps light/dark to the effective dark flag", () => {
    expect(effectiveDark("light")).toBe(false);
    expect(effectiveDark("dark")).toBe(true);
  });

  it("defaults to light when nothing is stored", async () => {
    await expect(readThemePreference()).resolves.toBe("light");
  });

  it("falls back to light for an invalid stored value", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "auto" });

    await expect(readThemePreference()).resolves.toBe("light");
  });

  it("reads a persisted manual override", async () => {
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" });

    await expect(readThemePreference()).resolves.toBe("dark");
  });

  it("writes the preference to local storage", async () => {
    await writeThemePreference("dark");

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" });
  });

  it("applies a manual override to the document root", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { dataset } });

    await applyThemePreferenceToDocument("light");

    expect(dataset.theme).toBe("light");
    vi.unstubAllGlobals();
  });

  it("always sets a data-theme value for extension pages", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { dataset } });

    await applyThemePreferenceToDocument("dark");

    expect(dataset.theme).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("initializes pages from storage and starts listening for changes", async () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal("document", { documentElement: { dataset } });
    chromeMock.storage.local.get.mockResolvedValue({ [THEME_PREFERENCE_STORAGE_KEY]: "dark" });

    await initPageTheme();

    expect(dataset.theme).toBe("dark");
    expect(chromeMock.storage.onChanged.addListener).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("applies the manual override to the Chrome toolbar icon", async () => {
    await applyThemePreferenceToIcon("dark");

    expect(chromeMock.action.setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ 16: "icons/icon-bg16.png", 128: "icons/icon-bg128.png" }),
    });
  });

  it("uses the transparent icon for light mode by default", async () => {
    await applyThemePreferenceToIcon("light");

    expect(chromeMock.action.setIcon).toHaveBeenCalledWith({
      path: expect.objectContaining({ 16: "icons/icon16.png", 128: "icons/icon128.png" }),
    });
  });
});
