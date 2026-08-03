declare module "@moss/ui/tokens" {
  export const TOKEN_VERSION: 1;

  export type ThemeName = "light" | "dark";

  export type ColorRole =
    | "surface"
    | "surfaceMuted"
    | "surfaceElevated"
    | "border"
    | "text"
    | "textMuted"
    | "accent"
    | "accentText"
    | "focus"
    | "info"
    | "caution"
    | "danger"
    | "success";

  export interface ThemeTokens {
    color: Record<ColorRole, string>;
    space: Record<string, number>;
    radius: Record<string, number>;
    size: Record<string, number>;
    border: Record<string, number>;
    shadow: Record<string, string>;
    layer: Record<string, number>;
    density: {
      compact: { padX: number; padY: number; gap: number; control: number };
      comfortable: { padX: number; padY: number; gap: number; control: number };
    };
  }

  export const SEMANTIC: { light: ThemeTokens; dark: ThemeTokens };
  export const COMPONENTS: Readonly<Record<string, unknown>>;
  export function toCss(): string;
  export function validateTokens(): {
    ok: boolean;
    schema: { ok: boolean; errors: string[] };
    contrast: {
      ok: boolean;
      results: Array<{
        theme: ThemeName;
        name: string;
        ratio: number;
        min: number;
        pass: boolean;
      }>;
    };
    unused: {
      unusedSemantic: string[];
      unusedPrimitives: string[];
      usedSemanticCount: number;
      semanticCount: number;
    };
    unusedBrandColors: string[];
  };
  export function reportUnusedTokens(): {
    unusedSemantic: string[];
    unusedPrimitives: string[];
    usedSemanticCount: number;
    semanticCount: number;
  };
}
