/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module "*.png" {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  VITE_LANDING_URL: string;
}
