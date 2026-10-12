// Shared domain types for the side panel, the providers and the lib/ helpers.

/** Result of any REST call, independent of transport (page-injected cookie fetch or bearer-token fetch). */
export interface RestResponse<T = any> {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
  /** WP collection endpoints only (X-WP-Total / X-WP-TotalPages). */
  total?: number;
  totalPages?: number;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type EntityType = 'post' | 'term';

export interface PolylangLanguage {
  slug: string;
  name?: string;
  postId: number | null;
  current?: boolean;
}

/** What #seb-bridge-data contains (printed by the bridge plugin for logged-in editors). */
export interface BridgeData {
  authenticated: boolean;
  error?: string;
  user?: { id: number; name: string; capabilities: string[] };
  restRoot: string;
  nonce: string;
  isFrontPage: boolean;
  post: { id: number; type: string; restBase: string } | null;
  term: { id: number; taxonomy: string; restBase: string } | null;
  languages: PolylangLanguage[] | null;
  providers: string[];
  editUrl: string | null;
}

/** Serializable description of "what is being edited" — survives without a tab (connection mode). */
export interface EntityRef {
  restRoot: string;
  entityType: EntityType | null;
  postId?: number;
  postType?: string;
  taxonomy?: string;
  restBase?: string;
  providers: string[];
  isFrontPage: boolean;
  languages: PolylangLanguage[] | null;
}

/** Runtime editing context handed to every provider. */
export interface EditorContext extends EntityRef {
  /** Only in live mode (tab-bound). */
  tabId?: number;
  nonce?: string;
  editUrl: string | null;
  request: (url: string, options?: RequestOptions) => Promise<RestResponse>;
  uploadImage: (base64: string, filename: string, mime: string) => Promise<RestResponse>;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'json'
  | 'email'
  | 'url'
  | 'price'
  | 'integer'
  | 'number'
  | 'slug'
  | 'image'
  | 'date'
  | 'datetime'
  | 'time'
  | 'readonly';

export interface SelectOption {
  value: string;
  label: string;
}

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  value: any;
  options?: Array<SelectOption | string>;
  /** Mask lower bound for number-ish fields ('' = none). */
  min?: string | number;
  /** Image fields: thumbnail to show. */
  previewUrl?: string;
  /** Small hint printed under the input. */
  hint?: string;
  /** Provider-private data that must survive caching (e.g. the original ACF type). */
  meta?: Record<string, unknown>;
}

export type FieldValues = Record<string, any>;

export interface Provider<TData = any> {
  id: string;
  detect(ctx: EntityRef): boolean;
  load(ctx: EditorContext): Promise<TData>;
  getSchema(data: TData): Field[];
  /** `schema` is the schema the values were edited against — lets providers convert/skip per field. */
  save(ctx: EditorContext, values: FieldValues, schema: Field[]): Promise<unknown>;
}

export interface Connection {
  restRoot: string;
  siteUrl?: string;
  userLogin?: string;
  userName?: string;
  userId?: number;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  providers?: string[];
}

/** Response of /auth/login, /auth/refresh, /auth/session. */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user?: { id: number; name: string; login: string };
  site?: { url: string; restRoot: string };
  providers?: string[];
}

export type LangSetting = 'auto' | 'en' | 'ru';
export type ThemeSetting = 'auto' | 'light' | 'dark';

export interface Settings {
  lang: LangSetting;
  theme: ThemeSetting;
  /** providerId -> open/closed */
  sections: Record<string, boolean>;
}
